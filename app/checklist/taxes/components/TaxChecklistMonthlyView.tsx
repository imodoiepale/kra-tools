// @ts-nocheck
"use client"

import React, { useMemo, useState, useCallback } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Upload, Eye, Search, Send, X } from "lucide-react";
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from 'next/image';
import { Skeleton } from "@/components/ui/skeleton"
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";


const columnHelper = createColumnHelper();

const UpdateDialog = ({ title, initialValue, onUpdate, type, companyName, taxType, year, month }) => {
    const [value, setValue] = React.useState(initialValue);
    const [uploadedFile, setUploadedFile] = React.useState(null);

    const handleUpdate = async () => {
        if (type === 'advice') {
            if (uploadedFile) {
                const filePath = `${companyName}/Taxes/${taxType}/${year}/${month}/${uploadedFile.name}`;
                const { data, error } = await supabase.storage
                    .from('kra-documents')
                    .upload(filePath, uploadedFile);

                if (error) {
                    toast.error('Failed to upload file');
                    return;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('kra-documents')
                    .getPublicUrl(filePath);

                onUpdate({ advice: 'Receipt uploaded', receiptPath: filePath, receiptUrl: publicUrl });
            } else {
                onUpdate({ advice: value });
            }
        } else {
            onUpdate(value);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedFile(file);
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    {type === 'advice' ? (
                        initialValue?.advice || initialValue?.receiptUrl ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                        initialValue || <XCircle className="h-5 w-5 text-red-500" />
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    {type === 'date' ? (
                        <Input
                            type="date"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    ) : type === 'amount' ? (
                        <Input
                            type="number"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Enter amount"
                        />
                    ) : type === 'advice' ? (
                        <Tabs defaultValue="message">
                            <TabsList>
                                <TabsTrigger value="message">Paste Message</TabsTrigger>
                                <TabsTrigger value="upload">Upload Receipt</TabsTrigger>
                            </TabsList>
                            <TabsContent value="message">
                                <Textarea
                                    value={value?.advice || ''}
                                    onChange={(e) => setValue({ ...value, advice: e.target.value })}
                                    placeholder="Enter advice"
                                    rows={4}
                                />
                            </TabsContent>
                            <TabsContent value="upload">
                                <Input
                                    type="file"
                                    onChange={handleFileChange}
                                    accept="image/*,application/pdf"
                                />
                                {uploadedFile && (
                                    <p className="mt-2 text-sm text-gray-500">File selected: {uploadedFile.name}</p>
                                )}
                            </TabsContent>
                        </Tabs>
                    ) : (
                        <Input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Enter value"
                        />
                    )}
                    {initialValue?.receiptUrl && (
                        <ViewReceiptDialog url={initialValue.receiptUrl} />
                    )}
                    <DialogClose asChild>
                        <Button onClick={handleUpdate}>Update</Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const ViewReceiptDialog = ({ url }) => {
    const [isLoading, setIsLoading] = useState(true);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    View Receipt
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] sm:max-h-[800px]">
                <DialogHeader>
                    <DialogTitle>Receipt View</DialogTitle>
                </DialogHeader>
                <div className="mt-4 h-full">
                    <div className="w-full h-[600px] relative">
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Skeleton className="w-full h-full" />
                            </div>
                        )}
                        <Image
                            src={url}
                            alt="Receipt"
                            layout="fill"
                            objectFit="contain"
                            sizes="(max-width: 800px) 100vw, 800px"
                            onLoad={() => setIsLoading(false)}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const formatDate = (dateString) => {
    if (!dateString || dateString === "No obligation") return dateString;

    let date;
    if (typeof dateString === 'string') {
        const formats = [
            /^\d{4}-\d{2}-\d{2}$/,
            /^\d{2}\.\d{2}\.\d{4}$/,
            /^\d{2}\/\d{2}\/\d{4}$/,
            /^\d{4}\/\d{2}\/\d{2}$/,
            /^\d{2}-\d{2}-\d{4}$/,
        ];

        for (const format of formats) {
            if (format.test(dateString)) {
                const parts = dateString.split(/[-./]/);
                const [year, month, day] = format === formats[0] || format === formats[3]
                    ? parts
                    : parts.reverse();
                date = new Date(year, month - 1, day);
                break;
            }
        }

        if (!date) {
            date = new Date(dateString);
        }
    } else if (dateString instanceof Date) {
        date = dateString;
    } else {
        return "Invalid date";
    }

    if (isNaN(date.getTime())) {
        return "Invalid date";
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
};

const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tax Checklist');

    // Add headers
    const headers = ['#', 'Company Name', 'Obligation Date', 'ITAX Submission Date', 'Submitted By', 'Client Payment Date', `${taxCategoryLabel} Amount`, 'Advice'];
    worksheet.addRow(headers);

    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' }  // Yellow background
    };

    // Add data
    data.forEach((company, index) => {
        const taxData = localChecklist[company.company_name]?.taxes?.[taxType]?.[year]?.[month];
        worksheet.addRow([
            index + 1,
            company.company_name,
            formatDate(company[`${taxType}_effective_from`] || taxData?.obligationDate),
            formatDate(taxData?.itaxSubmitDate),
            taxData?.submittedBy || '',
            formatDate(taxData?.clientPaymentDate),
            taxData ? formatAmount(taxData[taxAmountField]) : '',
            taxData?.advice || (taxData?.receiptUrl ? 'Receipt uploaded' : '')
        ]);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 10 ? 10 : maxLength;
    });

    // Add borders to all cells
    worksheet.eachRow({ includeEmpty: true }, row => {
        row.eachCell({ includeEmpty: true }, cell => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `tax_checklist_${taxType}_${format(selectedDate, 'MMMM_yyyy')}.xlsx`);
};


const getTaxCategoryLabel = (taxType) => {
    const labels = {
        vat: "VAT Amount",
        paye: "PAYE Amount",
        income_tax_company: "Income Tax",
        nita: "NITA Amount",
        housing_levy: "Housing Levy",
        resident_individual: "Resident Individual Tax",
        rent_income_mri: "Rent Income",
        turnover_tax: "Turnover Tax"
    };
    return labels[taxType] || `${taxType.toUpperCase()} Amount`;
};

const getTaxAmountField = (taxType) => {
    const fields = {
        vat: "vatAmount",
        paye: "payeAmount",
        income_tax_company: "incomeTaxAmount",
        nita: "nitaAmount",
        housing_levy: "housingLevyAmount",
        resident_individual: "residentIndividualAmount",
        rent_income_mri: "rentIncomeAmount",
        turnover_tax: "turnoverTaxAmount"
    };
    return fields[taxType] || `${taxType}Amount`;
};

const updateTaxStatus = async (companyName, year, month, status, taxType, companies) => {
    try {
        const company = companies.find(c => c.company_name === companyName);
        if (!company) {
            throw new Error('Company not found');
        }

        const { data, error } = await supabase
            .from('checklist')
            .select('taxes')
            .eq('company_name', companyName)
            .maybeSingle();

        const existingTaxes = data?.taxes || {};

        const updatedTaxes = {
            ...existingTaxes,
            [taxType]: {
                ...existingTaxes[taxType],
                [year]: {
                    ...existingTaxes[taxType]?.[year],
                    [month]: {
                        ...existingTaxes[taxType]?.[year]?.[month],
                        ...status
                    }
                }
            }
        };

        const upsertData = {
            company_name: companyName,
            kra_pin: company.kra_pin,
            taxes: updatedTaxes
        };

        const { error: upsertError } = await supabase
            .from('checklist')
            .upsert(upsertData, { onConflict: 'company_name' });

        if (upsertError) throw upsertError;

        toast.success('Tax status updated successfully');
        return updatedTaxes;
    } catch (error) {
        console.error('Error updating tax status:', error);
        toast.error('Failed to update tax status');
        throw error;
    }
};

const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return '';
    return `Ksh ${Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

const getStageStatus = (taxData, taxAmountField, company, localChecklist, taxType, year, month) => {
    if (!taxData) return { 
        text: "0/5 - ITAX Submission Pending", 
        count: 0, 
        style: { color: '#EF4444' }  // red-500
    };

    const trackingData = getForwardTrackingData(localChecklist, company.company_name, taxType, year, month);

    const stages = [
        { field: 'itaxSubmitDate', label: 'ITAX Submission', color: '#3B82F6' },  // blue-500
        { field: 'clientPaymentDate', label: 'Client Payment', color: '#8B5CF6' }, // purple-500
        { field: taxAmountField, label: 'Tax Amount', color: '#6366F1' },         // indigo-500
        { 
            field: 'paymentSlipForwarded', 
            label: 'Payment Slip', 
            color: '#EC4899',    // pink-500
            check: () => {
                // Consider the stage complete if payment slip is forwarded or tracking shows forwards
                return taxData.paymentSlipForwarded === true || (trackingData && trackingData.forwardCount > 0);
            }
        },
        { 
            field: 'advice', 
            label: 'Payment Proof', 
            color: '#14B8A6',    // teal-500
            check: (value) => value?.advice || value?.receiptUrl 
        }
    ];

    let completedCount = 0;
    let nextPending = '';
    let nextPendingColor = '';

    for (const stage of stages) {
        const value = taxData[stage.field];
        // Use custom check if provided, otherwise check for truthy value
        const isCompleted = stage.check ? stage.check(value) : Boolean(value);
        
        if (isCompleted) {
            completedCount++;
        } else if (!nextPending) {
            nextPending = stage.label;
            nextPendingColor = stage.color;
        }
    }

    if (completedCount === 5) {
        return { 
            text: "Completed", 
            count: 5, 
            style: { color: '#059669', fontWeight: 500 }  // green-600
        };
    }

    return {
        text: `${completedCount}/5 - ${nextPending} Pending`,
        count: completedCount,
        style: { color: nextPendingColor, fontWeight: 500 }
    };
};
// Add these types if you're using TypeScript
interface ForwardTracking {
    forwardCount: number;
    lastForwardDate: string;
}


const getForwardTrackingData = (checklist, companyName, taxType, year, month) => {
    try {
        return checklist[companyName]?.forward_tracking?.[taxType]?.[year]?.[month] || {
            forwardCount: 0,
            lastForwardDate: null
        };
    } catch (error) {
        console.error('Error getting forward tracking data:', error);
        return {
            forwardCount: 0,
            lastForwardDate: null
        };
    }
};


const getForwardStatus = (company, localChecklist, taxType, year, month) => {
    const taxData = localChecklist[company.company_name]?.taxes?.[taxType]?.[year]?.[month];
    const trackingData = getForwardTrackingData(localChecklist, company.company_name, taxType, year, month);
    const forwardCount = trackingData.forwardCount;
    const isForwarded = taxData?.paymentSlipForwarded || false;

    if (isForwarded) {
        return {
            text: `Sent (${forwardCount} ${forwardCount === 1 ? 'time' : 'times'})`,
            className: "bg-green-100 text-green-700"
        };
    }

    if (forwardCount > 0) {
        return {
            text: `Pending (Sent ${forwardCount} ${forwardCount === 1 ? 'time' : 'times'})`,
            className: "bg-yellow-100 text-yellow-700"
        };
    }

    return {
        text: "Not Sent",
        className: "bg-red-100 text-red-700"
    };
};


const ReminderFilters = ({ onFilterChange, currentFilter }) => {
    return (
        <div className="flex gap-2 mb-4">
            <Button
                variant={currentFilter === 'all' ? "secondary" : "outline"}
                size="sm"
                onClick={() => onFilterChange('all')}
            >
                All
            </Button>
            <Button
                variant={currentFilter === 'not_sent' ? "secondary" : "outline"}
                size="sm"
                onClick={() => onFilterChange('not_sent')}
            >
                Not Sent
            </Button>
            <Button
                variant={currentFilter === 'pending' ? "secondary" : "outline"}
                size="sm"
                onClick={() => onFilterChange('pending')}
            >
                Pending
            </Button>
            <Button
                variant={currentFilter === 'sent' ? "secondary" : "outline"}
                size="sm"
                onClick={() => onFilterChange('sent')}
            >
                Sent
            </Button>
        </div>
    );
};



export default function TaxChecklistMonthlyView({ companies, checklist: initialChecklist, taxType, selectedDate }) {
    const [localChecklist, setLocalChecklist] = useState(initialChecklist);
    const [showCounts, setShowCounts] = useState(true);
    const [selectedClients, setSelectedClients] = useState([]);
    const [showReminderDialog, setShowReminderDialog] = useState(false);
    const year = selectedDate.getFullYear().toString();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');

    const [showTotals, setShowTotals] = useState(true);

    const taxCategoryLabel = getTaxCategoryLabel(taxType);
    const taxAmountField = getTaxAmountField(taxType);
    const fetchLatestData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('checklist')
                .select('*')
                .in('company_name', companies.map(c => c.company_name));

            if (error) throw error;

            const newChecklist = {};
            data.forEach(item => {
                newChecklist[item.company_name] = item;
            });

            setLocalChecklist(newChecklist);
        } catch (error) {
            console.error('Error fetching latest data:', error);
            toast.error('Failed to refresh data');
        }
    }, [companies]);

    const handleUpdate = async (companyName, year, month, status) => {
        try {
            await updateTaxStatus(companyName, year, month, status, taxType, companies);
            await fetchLatestData();  // Refetch data after successful update
            toast.success('Updated successfully');
        } catch (error) {
            console.error('Error updating:', error);
            toast.error('Failed to update');
        }
    };

    const calculateCounts = useCallback(() => {
        const counts = {
            total: companies.length,
            completed: 0,
            pending: 0
        };

        companies.forEach(company => {
            const taxData = localChecklist[company.company_name]?.taxes?.[taxType]?.[year]?.[month];
            if (taxData && taxData.itaxSubmitDate && taxData.clientPaymentDate && taxData[taxAmountField]) {
                counts.completed++;
            } else {
                counts.pending++;
            }
        });

        return counts;
    }, [companies, localChecklist, taxType, year, month, taxAmountField]);

    const counts = useMemo(() => calculateCounts(), [calculateCounts]);


    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => info.getValue(),
            header: '#',
            size: 50,
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
            header: 'Company Name',
            size: 280,
        }),
        columnHelper.accessor(row => localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.submittedBy, {
            id: 'submittedBy',
            cell: info => {
                const value = info.getValue();
                const names = ['Tushar', 'Samarth', 'Wasim', 'Sylvia'];
                const randomName = names[Math.floor(Math.random() * names.length)];
                return value ? value : (
                    <UpdateDialog
                        title="Update Submitted By"
                        initialValue={randomName}
                        onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { submittedBy: newValue })}
                        type="text"
                    >
                        <XCircle className="h-5 w-5 text-red-500" />
                    </UpdateDialog>
                );
            },
            header: 'Acc Manager',
            size: 120,
        }),
        columnHelper.accessor(row => {
            const taxData = localChecklist[row.company_name]?.taxes?.[taxType];
            return row[`${taxType}_effective_from`] || (taxData && taxData[year] && taxData[year][month] && taxData[year][month].obligationDate);
        }, {
            id: 'obligationDate',
            cell: info => {
                const value = info.getValue();
                return value ? (
                    <div className="text-center">{formatDate(value)}</div>
                ) : (
                    <div className="text-center">
                        <UpdateDialog
                            title="Update Obligation Date"
                            initialValue=""
                            onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { obligationDate: newValue })}
                            type="date"
                        >
                            <XCircle className="h-5 w-5 text-red-500" />
                        </UpdateDialog>
                    </div>
                );
            },
            header: <div className="text-center">Obligation Date</div>,
            size: 120,
        }),
        columnHelper.accessor('separator1', {
            cell: () => null,
            header: '',
            size: 10,
        }),
        columnHelper.accessor(row => localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.itaxSubmitDate, {
            id: 'itaxSubmitDate',
            cell: info => {
                const value = info.getValue();
                return (
                    <div className="text-center">
                        {value ? (
                            formatDate(value)
                        ) : (
                            <UpdateDialog
                                title="Update ITAX Submit Date"
                                initialValue=""
                                onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { itaxSubmitDate: newValue })}
                                type="date"
                            >
                                <XCircle className="h-5 w-5 text-red-500" />
                            </UpdateDialog>
                        )}
                    </div>
                );
            },
            header: <div className="text-center">ITAX Submission Date</div>,
            size: 100,
        }),
        columnHelper.accessor(row => localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.clientPaymentDate, {
            id: 'clientPaymentDate',
            cell: info => {
                const value = info.getValue();
                return (
                    <div className="text-center">
                        {value ? (
                            formatDate(value)
                        ) : (
                            <UpdateDialog
                                title="Update Client Payment Date"
                                initialValue=""
                                onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { clientPaymentDate: newValue })}
                                type="date"
                            >
                                <XCircle className="h-5 w-5 text-red-500" />
                            </UpdateDialog>
                        )}
                    </div>
                );
            },
            header: <div className="text-center">Client Payment Date</div>,
            size: 100,
        }),
        columnHelper.accessor(row => {
            const taxData = localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month];
            return taxData ? taxData[taxAmountField] : undefined;
        }, {
            id: 'taxAmount',
            cell: info => {
                const value = info.getValue();
                return (
                    <div className="text-center">
                        <UpdateDialog
                            title={`Update ${taxCategoryLabel}`}
                            initialValue={value !== undefined ? value.toString() : ""}
                            onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { [taxAmountField]: parseFloat(newValue) })}
                            type="amount"
                        >
                            {value !== undefined ? (
                                <span className="text-green-600 font-medium">{formatAmount(value)}</span>
                            ) : (
                                <Button variant="ghost" size="sm">
                                    <XCircle className="h-5 w-5 text-red-500" />
                                </Button>
                            )}
                        </UpdateDialog>
                    </div>
                );
            },
            header: <div className="text-center">{taxCategoryLabel} Amount</div>,
            size: 100,
        }),
        columnHelper.accessor(row => {
            const taxData = localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month];
            const trackingData = getForwardTrackingData(localChecklist, row.company_name, taxType, year, month);
            return {
                isForwarded: taxData?.paymentSlipForwarded || false,
                forwardCount: trackingData.forwardCount || 0,
                lastForwardDate: trackingData.lastForwardDate
            };
        }, {
            id: 'paymentSlipForwarded',
            cell: info => {
                const value = info.getValue();
                return (
                    <div className="text-center">
                        <div>
                            {value.forwardCount > 0 ? (
                                <span className={`px-2 py-1 rounded-full text-xs ${value.isForwarded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {value.isForwarded ? '✅' : '⚠️'} ({value.forwardCount} {value.forwardCount === 1 ? 'time' : 'times'})
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                                    ❌ Not Sent
                                </span>
                            )}
                        </div>
                        {value.lastForwardDate && (
                            <div className="text-xs text-gray-500 mt-1">
                                Last: {format(new Date(value.lastForwardDate), 'dd/MM/yy HH:mm')}
                            </div>
                        )}
                    </div>
                );
            },
            header: <div className="text-center">Payment Slip Forwarded</div>,
            size: 150, 
        }),
        columnHelper.accessor(row => localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.advice, {
            id: 'advice',
            cell: info => {
                const value = info.getValue();
                const receiptUrl = localChecklist[info.row.original.company_name]?.taxes?.[taxType]?.[year]?.[month]?.receiptUrl;
                return (
                    <div className="max-w-xs truncate hover:whitespace-normal text-center">
                        {receiptUrl ? (
                            <ViewReceiptDialog url={receiptUrl} />
                        ) : (
                            <UpdateDialog
                                title="Payment Proof"
                                initialValue={value || ""}
                                onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, newValue)}
                                type="advice"
                                companyName={info.row.original.company_name}
                                taxType={taxType}
                                year={year}
                                month={month}
                            >
                                {value ? (
                                    <Button variant="ghost" size="sm">
                                        {value}
                                    </Button>
                                ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                )}
                            </UpdateDialog>
                        )}
                    </div>
                );
            },
            header: <div className="text-center">Payment Proof </div>,
            size: 100,
        }),

        columnHelper.accessor(row => {
            const taxData = localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month];
            return getStageStatus(taxData, taxAmountField, row, localChecklist, taxType, year, month);
        }, {
            id: 'stageStatus',
            cell: info => {
                const status = info.getValue();
                return (
                    <div className="text-center font-bold" style={status.style}>
                        {status.text}
                    </div>
                );
            },
            header: <div className="text-center">Stage Status</div>,
            size: 200,
        }),
    ], [year, month, localChecklist, taxType, handleUpdate, taxCategoryLabel]);

    const data = useMemo(() =>
        companies.map((company, index) => ({
            ...company,
            index: index + 1,
            checklistData: localChecklist[company.company_name]?.taxes?.[taxType]?.[year]?.[month] || {}
        })),
        [companies, localChecklist, taxType, year, month]
    );

    // Add this at the top with other state declarations
    const [searchQuery, setSearchQuery] = useState('');

    // Add this filtering function
    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;

        return data.filter(item => {
            const searchStr = searchQuery.toLowerCase();
            const companyName = item.company_name?.toLowerCase() || '';
            const taxData = localChecklist[item.company_name]?.taxes?.[taxType]?.[year]?.[month];

            // Search in multiple fields
            return (
                companyName.includes(searchStr) ||
                taxData?.submittedBy?.toLowerCase().includes(searchStr) ||
                taxData?.itaxSubmitDate?.includes(searchStr) ||
                taxData?.clientPaymentDate?.includes(searchStr) ||
                formatAmount(taxData?.[taxAmountField])?.toLowerCase().includes(searchStr)
            );
        });
    }, [data, searchQuery, localChecklist, taxType, year, month, taxAmountField]);

    // Update the table configuration to use filteredData
    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });


    const TotalsRow = ({ totals }) => (
        <>
            {[
                { label: 'Total', bgColor: 'bg-blue-100', count: totals.total },
                { label: 'Completed', bgColor: 'bg-green-100', count: totals.completed },
                { label: 'Pending', bgColor: 'bg-yellow-100', count: totals.pending },
            ].map(row => (
                <TableRow key={row.label} className={`${row.bgColor}`} style={{ height: '20px' }}>
                    <TableCell colSpan={5} className="font-bold uppercase text-xs P-1" style={{ height: '20px' }}>{row.label}</TableCell>
                    <TableCell className="text-center text-xs P-1" style={{ height: '20px' }}>{row.count}</TableCell>
                    <TableCell className="text-center text-xs P-1" style={{ height: '20px' }}>{row.count}</TableCell>
                    <TableCell className="text-center text-xs P-1" style={{ height: '20px' }}>{row.count}</TableCell>
                    <TableCell className="text-center text-xs P-1" style={{ height: '20px' }}>{row.count}</TableCell>
                    <TableCell className="text-center text-xs P-1" style={{ height: '20px' }}>{row.count}</TableCell>
                    <TableCell className="text-center text-xs P-1" style={{ height: '20px' }}></TableCell>
                    {/* <TableCell className="text-center text-xs P-1" style={{ height: '20px' }}></TableCell> */}
                </TableRow>
            ))}
        </>
    );

    const handleSendReminder = () => {
        setShowReminderDialog(true);
    };

    const handleClientSelection = (companyName) => {
        setSelectedClients(prev =>
            prev.includes(companyName)
                ? prev.filter(name => name !== companyName)
                : [...prev, companyName]
        );
    };

    const handleSendReminderConfirm = async () => {
        try {
            for (const clientName of selectedClients) {
                const currentTracking = getForwardTrackingData(localChecklist, clientName, taxType, year, month);
                const newForwardCount = (currentTracking.forwardCount || 0) + 1;

                // Get existing data
                const { data: existingData } = await supabase
                    .from('checklist')
                    .select('forward_tracking')
                    .eq('company_name', clientName)
                    .single();

                // Prepare the new forward tracking data
                const forwardTracking = existingData?.forward_tracking || {};

                // Update the nested structure
                const updatedForwardTracking = {
                    ...forwardTracking,
                    [taxType]: {
                        ...(forwardTracking[taxType] || {}),
                        [year]: {
                            ...(forwardTracking[taxType]?.[year] || {}),
                            [month]: {
                                forwardCount: newForwardCount,
                                lastForwardDate: new Date().toISOString()
                            }
                        }
                    }
                };

                // Update the database
                const { error: updateError } = await supabase
                    .from('checklist')
                    .update({
                        forward_tracking: updatedForwardTracking
                    })
                    .eq('company_name', clientName);

                if (updateError) throw updateError;
            }

            toast.success(`Reminders sent to ${selectedClients.length} clients`);
            await fetchLatestData();  // Refresh the data
            setShowReminderDialog(false);
            setSelectedClients([]);
        } catch (error) {
            console.error('Error sending reminders:', error);
            toast.error('Failed to send reminders');
        }
    };


    const LastForwardInfo = ({ trackingData }) => {
        if (!trackingData.lastForwardDate) return null;

        const lastForwardDate = new Date(trackingData.lastForwardDate);
        const formattedDate = format(lastForwardDate, 'dd/MM/yyyy HH:mm');

        return (
            <div className="text-xs text-gray-500 mt-1">
                Last sent: {formattedDate}
            </div>
        );
    };

    const [statusFilter, setStatusFilter] = useState('all');

    const filteredCompanies = useMemo(() => {
        return companies.filter(company => {
            const taxData = localChecklist[company.company_name]?.taxes?.[taxType]?.[year]?.[month];
            const trackingData = getForwardTrackingData(localChecklist, company.company_name, taxType, year, month);
            const isForwarded = taxData?.paymentSlipForwarded || false;

            switch (statusFilter) {
                case 'not_sent':
                    return trackingData.forwardCount === 0;
                case 'pending':
                    return trackingData.forwardCount > 0 && !isForwarded;
                case 'sent':
                    return isForwarded;
                default:
                    return true;
            }
        });
    }, [companies, localChecklist, taxType, year, month, statusFilter]);


    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-4 flex-1">
                    <h2 className="text-md font-bold uppercase">
                        Checklist - {format(selectedDate, 'MMMM yyyy')}
                    </h2>
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <Input
                                type="text"
                                placeholder="Search in table..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8"
                            />
                            <Search
                                className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                        <span className='font-bold'>Show Totals</span>
                        <Switch
                            checked={showTotals}
                            onCheckedChange={setShowTotals}
                            className="data-[state=checked]:bg-green-500"
                        />
                    </div>
                    <Button onClick={exportToExcel}>
                        Export to Excel
                    </Button>
                    <Button onClick={handleSendReminder}>
                        <Send className="mr-2 h-4 w-4" />
                        Send Reminder
                    </Button>
                </div>
            </div>
            <ScrollArea className="h-[600px]">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <TableHead
                                        key={header.id}
                                        className={`font-bold text-white bg-gray-600 text-left ${header.column.id.startsWith('separator') ? 'bg-gray-400' : ''}`}
                                        style={{ width: header.getSize() }}
                                    >
                                        {header.isPlaceholder ? null : (
                                            <div
                                                {...{
                                                    className: header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                                                    onClick: header.column.getToggleSortingHandler(),
                                                }}
                                            >
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {{
                                                    asc: ' 🔼',
                                                    desc: ' 🔽',
                                                }[header.column.getIsSorted()] ?? null}
                                            </div>
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                        {showTotals && <TotalsRow totals={counts} />}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.map(row => (
                            <TableRow key={row.id} className={row.index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                                {row.getVisibleCells().map(cell => (
                                    <TableCell
                                        key={cell.id}
                                        className={`text-left ${cell.column.id.startsWith('separator') ? 'bg-gray-200' : ''}`}
                                        style={{ width: cell.column.getSize() }}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>

            <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
                <DialogContent className="max-w-8xl max-h-[90vh] overflow-hidden flex flex-col">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold">Send Reminder</DialogTitle>
                            <DialogDescription>
                                Select companies to send reminders for pending tax submissions.
                            </DialogDescription>
                        </DialogHeader>
                    </motion.div>

                    <div className="flex flex-1 gap-4 mt-4 min-h-0">
                        <motion.div
                            className="flex-1"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                        >
                            <div className="p-2 rounded-lg border bg-muted/50">
                                <h3 className="font-semibold mb-2 px-2">Available Companies</h3>
                                <ScrollArea className="h-[400px] rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px] sticky top-0 bg-white">
                                                    <Checkbox
                                                        checked={companies.length === selectedClients.length}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedClients(companies.map(c => c.company_name));
                                                            } else {
                                                                setSelectedClients([]);
                                                            }
                                                        }}
                                                    />
                                                </TableHead>
                                                <TableHead className="sticky top-0 bg-white w-[60px]">#</TableHead>
                                                <TableHead className="sticky top-0 bg-white">Company Name</TableHead>
                                                <TableHead className="sticky top-0 bg-white w-[180px]">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {companies.map((company, index) => {
                                                const status = getForwardStatus(company, localChecklist, taxType, year, month);
                                                return (
                                                    <TableRow
                                                        key={company.company_name}
                                                        className={selectedClients.includes(company.company_name) ? "bg-muted/50" : ""}
                                                    >
                                                        <TableCell>
                                                            <Checkbox
                                                                checked={selectedClients.includes(company.company_name)}
                                                                onCheckedChange={() => handleClientSelection(company.company_name)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className=" font-medium">{index + 1}</TableCell>
                                                        <TableCell>{company.company_name}</TableCell>
                                                        <TableCell>
                                                            <span className={`px-2 py-1 rounded-full text-xs ${status.className}`}>
                                                                {status.text}
                                                            </span>
                                                            <LastForwardInfo
                                                                trackingData={getForwardTrackingData(localChecklist, company.company_name, taxType, year, month)}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        </motion.div>

                        <motion.div
                            className="flex-1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: 0.2 }}
                        >
                            <div className="p-2 rounded-lg border bg-blue-50">
                                <h3 className="font-semibold mb-2 px-2">Selected Companies ({selectedClients.length})</h3>
                                <ScrollArea className="h-[400px] rounded-md border bg-white">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="sticky top-0 bg-white w-[60px]">#</TableHead>
                                                <TableHead className="sticky top-0 bg-white">Company Name</TableHead>
                                                <TableHead className="sticky top-0 bg-white">Primary Director Name</TableHead>
                                                <TableHead className="sticky top-0 bg-white">Communication Email</TableHead>
                                                <TableHead className="sticky top-0 bg-white">Mobile Number</TableHead>
                                                <TableHead className="sticky top-0 bg-white w-[100px]">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedClients.map((clientName, index) => (
                                                <TableRow key={clientName}>
                                                    <TableCell className=" font-medium">{index + 1}</TableCell>
                                                    <TableCell>{clientName}</TableCell>
                                                    <TableCell>
                                                        {/* {client.primary_director_name} */}
                                                        </TableCell>
                                                    <TableCell>
                                                        {/* {client.communication_email} */}
                                                        </TableCell>
                                                    <TableCell>
                                                        {/* {client.mobile_number} */}
                                                        </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleClientSelection(clientName)}
                                                            className="bg-red-500 hover:bg-red-700 text-white font-bold"
                                                        >
                                                            Remove
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        </motion.div>
                    </div>

                    <motion.div
                        className="mt-4 space-y-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.3 }}
                    >
                        <div className="flex justify-between px-4 py-2 rounded-lg border bg-muted/50">
                            <div className="flex items-center space-x-2">
                                <span className="font-semibold">Send via Email</span>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="font-semibold">Send via WhatsApp</span>
                                <Switch />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowReminderDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSendReminderConfirm}
                                disabled={selectedClients.length === 0}
                                className="min-w-[140px]"
                            >
                                Send ({selectedClients.length})
                            </Button>
                        </div>
                    </motion.div>
                </DialogContent>
            </Dialog>
        </div>
    );
}