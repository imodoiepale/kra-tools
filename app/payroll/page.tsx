// Modified version of app/payroll/page.tsx to make it fully reusable

// ts-nocheck
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PayrollManagementWingu from "./payroll-management-wingu/PayrollManagementWingu"
import { CompanyView } from "./components/CompanyView" // Import our new component
import TaxPaymentSlips from "./tax-payment-slips/TaxPaymentSlips"
import { usePayrollCycle } from "./hooks/usePayrollCycle"
import { useEffect } from "react"
import PayslipPaymentReceipts from "./payslip-receipts/PayslipPaymentReceipts"
import ExtractionReport from "./extraction-report/ExtractionReport"

// Document labels for different tabs
const TAB_DOCUMENT_LABELS = {
    'wingu-csv': {
        paye_csv: "PAYE Returns (CSV)",
        hslevy_csv: "Housing Levy Returns (CSV)",
        zip_file_kra: "KRA ZIP File",
        shif_exl: "SHIF Returns (Excel)",
        nssf_exl: "NSSF Returns (Excel)",
        all_csv: "All CSV Files"
    },
    'tax-payment-slips': {
        paye_acknowledgment: "PAYE Ack.",
        paye_slip: "PAYE Payment",
        housing_levy_slip: "Housing Levy",
        nita_slip: "NITA",
        shif_slip: "SHIF",
        nssf_slip: "NSSF",
        all_csv: "All CSV Files"
    },
    'payslip-receipts': {
        paye_receipt: "PAYE",
        housing_levy_receipt: "Housing Levy",
        nita_receipt: "NITA",
        shif_receipt: "SHIF",
        nssf_receipt: "NSSF",
        all_csv: "All CSV Files"
    },
    'extraction-report': {
        report_pdf: "Report",
        summary_csv: "Summary",
        all_csv: "All CSV Files"
    }
};

// Document field names for different tabs
const TAB_DOCUMENT_FIELDS = {
    'wingu-csv': 'documents',
    'tax-payment-slips': 'payment_slips_documents',
    'payslip-receipts': 'payment_receipts_documents',
    'extraction-report': 'extraction_documents'
};

export default function PortalPage() {
    const payrollCycle = usePayrollCycle()

    useEffect(() => {
        payrollCycle.fetchOrCreatePayrollCycle()
    }, [payrollCycle.selectedYear, payrollCycle.selectedMonth, payrollCycle.searchTerm])

    return (
        <div className="mx-auto p-2">
            <Tabs defaultValue="wingu-csv" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="wingu-csv">PAYROLL WINGU CSV AUTO</TabsTrigger>
                    <TabsTrigger value="tax-payment-slips">TAX PAYMENT SLIPS WEB AUTO</TabsTrigger>
                    <TabsTrigger value="payslip-receipts">PAYSLIP PAYMENT RECEIPTS</TabsTrigger>
                    <TabsTrigger value="extraction-report">EXTRACTIONS REPORT</TabsTrigger>
                </TabsList>

                {/* PAYROLL WINGU CSV AUTO Tab */}
                <TabsContent value="wingu-csv" className="space-y-4">
                    <Tabs defaultValue="monthly" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="monthly">Monthly View</TabsTrigger>
                            <TabsTrigger value="detailed">Company View</TabsTrigger>
                        </TabsList>
                        <TabsContent value="monthly">
                            <PayrollManagementWingu {...payrollCycle} />
                        </TabsContent>
                        <TabsContent value="detailed">
                            <CompanyView
                                payrollRecords={payrollCycle.payrollRecords}
                                onDocumentUpload={payrollCycle.handleDocumentUpload}
                                onDocumentDelete={payrollCycle.handleDocumentDelete}
                                onStatusUpdate={payrollCycle.handleStatusUpdate}
                                tabType="payroll"
                                documentLabels={TAB_DOCUMENT_LABELS['wingu-csv']}
                                documentsField={TAB_DOCUMENT_FIELDS['wingu-csv']}
                            />
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                {/* TAX PAYMENT SLIPS Tab */}
                <TabsContent value="tax-payment-slips">
                    <Tabs defaultValue="monthly" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="monthly">Monthly View</TabsTrigger>
                            <TabsTrigger value="detailed">Company View</TabsTrigger>
                        </TabsList>
                        <TabsContent value="monthly">
                            <TaxPaymentSlips {...payrollCycle} />
                        </TabsContent>
                        <TabsContent value="detailed">
                            <CompanyView
                                payrollRecords={payrollCycle.payrollRecords}
                                onDocumentUpload={payrollCycle.handleDocumentUpload}
                                onDocumentDelete={payrollCycle.handleDocumentDelete}
                                onStatusUpdate={payrollCycle.handleStatusUpdate}
                                tabType="tax-payment"
                                documentLabels={TAB_DOCUMENT_LABELS['tax-payment-slips']}
                                documentsField={TAB_DOCUMENT_FIELDS['tax-payment-slips']}
                            />
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                {/* PAYSLIP PAYMENT RECEIPTS Tab */}
                <TabsContent value="payslip-receipts">
                    <Tabs defaultValue="monthly" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="monthly">Monthly View</TabsTrigger>
                            <TabsTrigger value="detailed">Company View</TabsTrigger>
                        </TabsList>
                        <TabsContent value="monthly">
                            <PayslipPaymentReceipts {...payrollCycle} />
                        </TabsContent>
                        <TabsContent value="detailed">
                            <CompanyView
                                payrollRecords={payrollCycle.payrollRecords}
                                onDocumentUpload={payrollCycle.handleDocumentUpload}
                                onDocumentDelete={payrollCycle.handleDocumentDelete}
                                onStatusUpdate={payrollCycle.handleStatusUpdate}
                                tabType="payslip-receipts"
                                documentLabels={TAB_DOCUMENT_LABELS['payslip-receipts']}
                                documentsField={TAB_DOCUMENT_FIELDS['payslip-receipts']}
                            />
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                {/* EXTRACTIONS REPORT Tab */}
                <TabsContent value="extraction-report">
                    <Tabs defaultValue="monthly" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="monthly">Monthly View</TabsTrigger>
                            <TabsTrigger value="detailed">Company View</TabsTrigger>
                        </TabsList>
                        <TabsContent value="monthly">
                            <ExtractionReport {...payrollCycle} />
                        </TabsContent>
                        <TabsContent value="detailed">
                            <CompanyView
                                payrollRecords={payrollCycle.payrollRecords}
                                onDocumentUpload={payrollCycle.handleDocumentUpload}
                                onDocumentDelete={payrollCycle.handleDocumentDelete}
                                onStatusUpdate={payrollCycle.handleStatusUpdate}
                                tabType="extraction-report"
                                documentLabels={TAB_DOCUMENT_LABELS['extraction-report']}
                                documentsField={TAB_DOCUMENT_FIELDS['extraction-report']}
                            />
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>
        </div>
    )
}