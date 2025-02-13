// app/portal/page.tsx
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PayrollManagementWingu from "./PayrollManagementWingu"

export default function PortalPage() {
    return (
        <div className=" mx-auto p-4">
            <Tabs defaultValue="wingu-csv" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="wingu-csv">PAYROLL WINGU CSV AUTO</TabsTrigger>
                    <TabsTrigger value="other">Other Tab</TabsTrigger>
                </TabsList>
                <TabsContent value="wingu-csv" className="space-y-4">
                    <PayrollManagementWingu />
                </TabsContent>
                <TabsContent value="other">
                    Other content
                </TabsContent>
            </Tabs>
        </div>
    )
}