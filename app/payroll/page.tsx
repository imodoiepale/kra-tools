// ts-nocheck
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PayrollManagementWingu from "./payroll-management-wingu/PayrollManagementWingu"
import TaxPaymentSlips from "./tax-payment-slips/TaxPaymentSlips"
import { usePayrollCycle } from "./hooks/usePayrollCycle"
import { useEffect } from "react"
import PayslipPaymentReceipts from "./payslip-receipts/PayslipPaymentReceipts"

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
                </TabsList>
                <TabsContent value="wingu-csv" className="space-y-4">
                    <PayrollManagementWingu {...payrollCycle} />
                </TabsContent>
                <TabsContent value="tax-payment-slips">
                    <TaxPaymentSlips {...payrollCycle} />
                </TabsContent>
                <TabsContent value="payslip-receipts">
                    <PayslipPaymentReceipts {...payrollCycle} />
                </TabsContent>
            </Tabs>
        </div>
    )
}