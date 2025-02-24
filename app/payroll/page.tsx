// ts-nocheck
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PayrollManagementWingu from "./payroll-management-wingu/PayrollManagementWingu"
import TaxPaymentSlips from "./tax-payment-slips/TaxPaymentSlips"
import { usePayrollCycle } from "./hooks/usePayrollCycle"
import { useEffect } from "react"
import PayslipPaymentReceipts from "./payslip-receipts/PayslipPaymentReceipts"
import ExtractionReport from "./extraction-report/ExtractionReport"

export default function PortalPage() {
    const payrollCycle = usePayrollCycle()

    useEffect(() => {
        payrollCycle.fetchOrCreatePayrollCycle()
    }, [payrollCycle.selectedYear, payrollCycle.selectedMonth, payrollCycle.searchTerm])

    return (
        <div className="mx-auto p-4">
            <Tabs defaultValue="wingu-csv" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="wingu-csv">PAYROLL WINGU CSV AUTO</TabsTrigger>
                    <TabsTrigger value="tax-payment-slips">TAX PAYMENT SLIPS WEB AUTO</TabsTrigger>
                    <TabsTrigger value="payslip-receipts">PAYSLIP PAYMENT RECEIPTS</TabsTrigger>
                    <TabsTrigger value="extraction-report">EXTRACTIONS REPORT</TabsTrigger>
                </TabsList>
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
                            <div className="p-4">Company View for Payroll Management Wingu</div>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
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
                            <div className="p-4">Company View for Tax Payment Slips</div>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
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
                            <div className="p-4">Company View for Payslip Payment Receipts</div>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
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
                            <div className="p-4">Company View for Extraction Report</div>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>
        </div>
    )
}