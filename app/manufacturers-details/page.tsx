// components/ManufacturersDetails.tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import ManufacturersDetailsCompanies from './companies/page';
import ManufacturersDetailsSuppliers from "./suppliers/page";
import ManufacturersDetailsCustomers from "./customers/page";

export default function ManufacturersDetailsPage() {
    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader>
                    <CardTitle>Manufacturers Details Checker</CardTitle>
                    <CardDescription>Extract and validate manufacturers details from KRA</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="companies">
                        <TabsList>
                            <TabsTrigger value="companies">Companies</TabsTrigger>
                            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                            <TabsTrigger value="customers">Customers</TabsTrigger>
                        </TabsList>
                        <TabsContent value="companies">
                            <ManufacturersDetailsCompanies />
                        </TabsContent>
                        <TabsContent value="suppliers">
                            <ManufacturersDetailsSuppliers />
                        </TabsContent>
                        <TabsContent value="customers">
                           <ManufacturersDetailsCustomers />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}