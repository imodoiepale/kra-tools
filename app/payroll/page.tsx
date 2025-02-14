// app/portal/page.tsx
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PayrollManagementWingu from "./PayrollManagementWingu"
import TaxPaymentSlips from "./tax-payment-slips/TaxPaymentSlips"
import { usePayrollCycle } from "./hooks/usePayrollCycle"
import { useEffect } from "react"

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
                </TabsList>
                <TabsContent value="wingu-csv" className="space-y-4">
                    <PayrollManagementWingu {...payrollCycle} />
                </TabsContent>
                <TabsContent value="tax-payment-slips">
                    <TaxPaymentSlips {...payrollCycle} />
                </TabsContent>
            </Tabs>
        </div>
    )
}