// components/ManufacturersDetails.tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import ManufacturersDetailsCompanies from './companies/page';
import ManufacturersDetailsSuppliers from "./suppliers+customers/page";

export default function ManufacturersDetailsPage() {
    return (
        <div className="h-[calc(100vh-80px)] p-4 flex flex-col">
            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="flex-none">
                    <CardTitle>Manufacturers Details Checker</CardTitle>
                    <CardDescription>Extract and validate manufacturers details from KRA</CardDescription>
                </CardHeader>
                <CardContent className="">
                    <Tabs defaultValue="companies">
                        <TabsList>
                            <TabsTrigger value="companies">Companies</TabsTrigger>
                            <TabsTrigger value="suppliers">Suppliers and Customers</TabsTrigger>
                        </TabsList>
                        <div className="flex-1 overflow-hidden px-6 py-4">
                            <TabsContent value="companies" className="h-full m-0 data-[state=active]:flex">
                                <ManufacturersDetailsCompanies />
                            </TabsContent>
                            <TabsContent value="suppliers" className="h-full m-0 data-[state=active]:flex">
                                <ManufacturersDetailsSuppliers />
                            </TabsContent>
                        </div>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}