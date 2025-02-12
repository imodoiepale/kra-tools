// app/portal/page.tsx
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PayrollManagementWingu from "./PayrollManagementWingu"

export default function PortalPage() {
    return (
        <div className="container mx-auto p-6">
            <Tabs defaultValue="payroll" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="payroll">Payroll Management</TabsTrigger>
                    <TabsTrigger value="other">Other Tab</TabsTrigger>
                </TabsList>
                <TabsContent value="payroll" className="space-y-4">
                    <PayrollManagementWingu />
                </TabsContent>
                <TabsContent value="other">
                    Other content
                </TabsContent>
            </Tabs>
        </div>
    )
}