// @ts-nocheck
"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Building2,
    Calendar,
    FileText,
    CheckCircle,
    XCircle,
    AlertCircle,
    Search,
    Download,
    Filter,
    Eye,
    TrendingUp,
} from "lucide-react"
import { useIncomeTaxReturns } from "../hooks/useIncomeTaxReturns"
import { SectionDataTable } from "../components/SectionDataTable"

const incomeTaxSections = [
    { key: "sectionA", name: "Section A", fullName: "Return Information" },
    { key: "sectionB1", name: "Section B1", fullName: "Profit/Loss Account" },
    { key: "sectionB", name: "Section B", fullName: "Profit/Surplus and Loss Account" },
    { key: "sectionB2", name: "Section B2", fullName: "Related Party Transactions" },
    { key: "sectionC", name: "Section C", fullName: "Balance Sheet" },
    { key: "sectionD", name: "Section D", fullName: "Stock Details" },
    { key: "sectionE1", name: "Section E1", fullName: "Capital Allowances Additions" },
    { key: "sectionE2", name: "Section E2", fullName: "Wear and Tear Deductions" },
    { key: "sectionE2Part3", name: "Section E2 Part 3", fullName: "Additional Wear and Tear" },
    { key: "sectionE", name: "Section E", fullName: "Summary of Capital Allowance" },
    { key: "sectionF", name: "Section F", fullName: "Installment Tax Paid" },
    { key: "sectionG", name: "Section G", fullName: "Tax Withheld" },
    { key: "sectionH", name: "Section H", fullName: "Advance Tax on Commercial Vehicles" },
    { key: "sectionI", name: "Section I", fullName: "Income Tax Paid" },
    { key: "sectionJ", name: "Section J", fullName: "Double Taxation Agreement" },
    { key: "sectionK", name: "Section K", fullName: "Losses" },
    { key: "sectionL", name: "Section L", fullName: "Partnership Income" },
    { key: "sectionM", name: "Section M", fullName: "Tax Computation" },
    { key: "sectionN", name: "Section N", fullName: "Distribuatable Income" },
  ]

export default function IncomeTaxDashboard({ company }) {
    const [selectedSection, setSelectedSection] = useState("sectionA")
    const [searchTerm, setSearchTerm] = useState("")
    const [activeTab, setActiveTab] = useState("listings")

    const {
        rawData,
        isLoading,
        error,
        getListingsData,
        getSectionData,
        getSectionStatus,
    } = useIncomeTaxReturns(company?.id || null)

    // Utility functions
    const getStatusIcon = (status) => {
        switch (status) {
            case "success":
                return <CheckCircle className="h-3 w-3 text-green-500" />
            case "error":
                return <XCircle className="h-3 w-3 text-red-500" />
            case "not_found":
                return <AlertCircle className="h-3 w-3 text-yellow-500" />
            default:
                return <AlertCircle className="h-3 w-3 text-gray-500" />
        }
    }

    const getStatusBadge = (status) => {
        const variants = {
            success: "default",
            error: "destructive",
            not_found: "secondary",
            processing: "outline",
        }

        return (
            <Badge variant={variants[status] || "outline"} className="text-xs px-1.5 py-0.5">
                {status.replace("_", " ").toUpperCase()}
            </Badge>
        )
    }

    const formatCurrency = (value) => {
        if (typeof value === "number") {
            return new Intl.NumberFormat("en-KE", {
                style: "currency",
                currency: "KES",
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            }).format(value)
        }
        if (typeof value === "string") {
            const cleanValue = value.replace(/[^\d.-]/g, "")
            if (!isNaN(Number(cleanValue)) && cleanValue !== "") {
                return new Intl.NumberFormat("en-KE", {
                    style: "currency",
                    currency: "KES",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                }).format(Number(cleanValue))
            }
        }
        return value
    }

    const formatDate = (dateString) => {
        if (!dateString) return ""
        try {
            return new Date(dateString).toLocaleDateString("en-KE", {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
        } catch {
            return dateString
        }
    }

    // Loading and error states
    if (!company) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
                <p className="text-gray-500 text-sm">Select a company to view details.</p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-500 text-sm">Loading income tax returns...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
                <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-500 text-sm">Error loading data</p>
                    <p className="text-gray-500 text-xs mt-1">{error.message}</p>
                </div>
            </div>
        )
    }

    const listingsData = getListingsData()
    const sectionData = getSectionData(selectedSection)

    const filteredReturns = listingsData.filter((returnItem) =>
        Object.values(returnItem).some((value) =>
            value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
    )

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Fixed Header - Compact */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div>
                            <h1 className="text-base font-semibold flex items-center space-x-2">
                                <Building2 className="h-4 w-4" />
                                <span>{company.name}</span>
                            </h1>
                            <p className="text-xs text-gray-500">KRA PIN: {company.kra_pin}</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs">
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                            <Download className="h-3 w-3 mr-1" />
                            Export
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                            <Filter className="h-3 w-3 mr-1" />
                            Filter
                        </Button>
                        <div className="flex items-center space-x-1 text-gray-500">
                            <Calendar className="h-3 w-3" />
                            Last Update: {rawData && rawData.length > 0 ? formatDate(rawData[0]?.extraction_timestamp) : "N/A"}
                        </div>
                        <div className="flex items-center space-x-1 text-gray-500">
                            <FileText className="h-3 w-3" />
                            {listingsData.length} Returns Filed
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content - Full height minus header */}
            <div className="flex-1 overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    {/* Compact Tabs Header */}
                    <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-1">
                        <TabsList className="grid w-full max-w-md grid-cols-2 h-8">
                            <TabsTrigger value="listings" className="flex items-center space-x-1 text-xs px-2">
                                <FileText className="h-3 w-3" />
                                <span>All Return Listings</span>
                            </TabsTrigger>
                            <TabsTrigger value="sections" className="flex items-center space-x-1 text-xs px-2">
                                <TrendingUp className="h-3 w-3" />
                                <span>Section Details</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Tab Content - Full remaining height */}
                    <div className="flex-1 overflow-hidden">
                        {/* All Return Listings Tab */}
                        <TabsContent value="listings" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                            <div className="flex-shrink-0 p-3 bg-white border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-medium">Filed Returns Summary</h2>
                                    <div className="flex items-center space-x-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-400" />
                                            <Input
                                                placeholder="Search returns..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-7 w-48 h-7 text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden p-3">
                                <div className="h-full bg-white rounded-lg border overflow-hidden">
                                    <ScrollArea className="h-full">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-white z-10 border-b">
                                                <TableRow className="h-9">
                                                    <TableHead className="text-xs font-medium w-12 px-2">Sr.No.</TableHead>
                                                    <TableHead className="text-xs font-medium min-w-[140px] px-2">Acknowledgement No</TableHead>
                                                    <TableHead className="text-xs font-medium min-w-[100px] px-2">Return Period from</TableHead>
                                                    <TableHead className="text-xs font-medium min-w-[100px] px-2">Return Period to</TableHead>
                                                    <TableHead className="text-xs font-medium min-w-[100px] px-2">Date of Filing</TableHead>
                                                    <TableHead className="text-xs font-medium min-w-[120px] px-2">Type of Return</TableHead>
                                                    <TableHead className="text-xs font-medium min-w-[100px] px-2">Entity Type</TableHead>
                                                    <TableHead className="text-xs font-medium min-w-[120px] px-2">Tax Obligation</TableHead>
                                                    <TableHead className="text-xs font-medium w-20 px-2">Status</TableHead>
                                                    <TableHead className="text-xs font-medium w-24 px-2">NSSF Status</TableHead>
                                                    <TableHead className="text-xs font-medium w-20 px-2">View Return Filed</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredReturns.map((returnItem, index) => {
                                                    // Extract data from return_info_summary JSONB column
                                                    const summary = returnItem.return_info_summary || {}

                                                    return (
                                                        <TableRow key={index} className="h-10 hover:bg-gray-50">
                                                            <TableCell className="text-xs px-2">{index + 1}</TableCell>
                                                            <TableCell className="font-medium text-xs font-mono px-2">
                                                                {returnItem.acknowledgement_no}
                                                            </TableCell>
                                                            <TableCell className="text-xs px-2">{returnItem.return_period_from}</TableCell>
                                                            <TableCell className="text-xs px-2">{returnItem.return_period_to}</TableCell>
                                                            <TableCell className="text-xs px-2">{returnItem.date_of_filing}</TableCell>
                                                            <TableCell className="text-xs px-2">
                                                                {summary["Type of Return"] || "Annual Return"}
                                                            </TableCell>
                                                            <TableCell className="text-xs px-2">
                                                                {summary["Entity Type"] || "Company"}
                                                            </TableCell>
                                                            <TableCell className="text-xs px-2">
                                                                {summary["Tax Obligation"] || "Income Tax"}
                                                            </TableCell>
                                                            <TableCell className="px-2">
                                                                <Badge variant="default" className="text-xs px-1 py-0">
                                                                    {summary["Status"] || "Filed"}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="px-2">
                                                                <Badge variant="default" className="text-xs px-1 py-0">
                                                                    {summary["NSSF Status"] || "Compliant"}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="px-2">
                                                                <Button variant="outline" size="sm" className="h-6 text-xs px-1">
                                                                    <Eye className="h-3 w-3" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Section Details Tab */}
                        <TabsContent value="sections" className="h-full mt-0 data-[state=active]:flex">
                            <div className="h-full flex w-full">
                                {/* Section Navigation Sidebar - Fixed width, scrollable */}
                                <div className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
                                    <div className="flex-shrink-0 p-3 border-b border-gray-200">
                                        <h2 className="text-sm font-medium">Income Tax Sections</h2>
                                    </div>
                                    <ScrollArea className="flex-1">
                                        <div className="p-2">
                                            {incomeTaxSections.map((section) => {
                                                const status = getSectionStatus(section.key)

                                                return (
                                                    <Button
                                                        key={section.key}
                                                        variant={selectedSection === section.key ? "default" : "ghost"}
                                                        className="w-full justify-start h-auto p-2 mb-1 text-xs"
                                                        onClick={() => setSelectedSection(section.key)}
                                                    >
                                                        <div className="flex items-start space-x-2 w-full">
                                                            {getStatusIcon(status)}
                                                            <div className="text-left flex-1 min-w-0">
                                                                <div className="font-medium text-xs">{section.name}</div>
                                                                <div className="text-xs text-gray-500 truncate">{section.fullName}</div>
                                                            </div>
                                                        </div>
                                                    </Button>
                                                )
                                            })}
                                        </div>
                                    </ScrollArea>
                                </div>

                                {/* Section Content - Flexible width, scrollable */}
                                <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
                                    {/* Compact Section Header */}
                                    <div className="flex-shrink-0 bg-white border-b border-gray-200 p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <h3 className="text-sm font-medium">
                                                        {incomeTaxSections.find((s) => s.key === selectedSection)?.name}
                                                    </h3>
                                                    {getStatusBadge(getSectionStatus(selectedSection))}
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    {incomeTaxSections.find((s) => s.key === selectedSection)?.fullName}
                                                </p>
                                            </div>
                                            <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                                                <Download className="h-3 w-3 mr-1" />
                                                Export Section
                                            </Button>
                                        </div>

                                        {/* Section Statistics */}
                                        {sectionData && sectionData.length > 0 && (
                                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                                <div className="flex items-center">
                                                    <FileText className="h-3 w-3 mr-1" />
                                                    {sectionData.length} return periods
                                                </div>
                                                <div>
                                                    {/* Count data columns dynamically */}
                                                    {(() => {
                                                        let columnCount = 0;
                                                        sectionData.forEach(period => {
                                                            Object.keys(period).forEach(key => {
                                                                if (key.startsWith('table_') && period[key]) {
                                                                    columnCount++;
                                                                }
                                                            });
                                                        });
                                                        return `${columnCount} data columns`;
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Section Table - Full remaining height */}
                                    <div className="flex-1 overflow-hidden p-3">
                                        <div className="h-full bg-white rounded-lg border overflow-hidden">
                                            <SectionDataTable
                                                sectionData={sectionData}
                                                selectedSection={selectedSection}
                                                formatCurrency={formatCurrency}
                                                formatDate={formatDate}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}