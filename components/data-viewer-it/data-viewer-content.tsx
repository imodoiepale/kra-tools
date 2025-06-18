
// @ts-nocheck
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Search, Building2, FileText, BarChart3, Users, CalendarDays, AlertTriangle, CheckCircle, Mail } from "lucide-react"
import { getFilteredCompanyDataAction } from "@/app/filed-it/actions"
import type { EnrichedCompany, CompanyItReturnListings } from "@/lib/data-viewer-it/supabase"
import { CategoryFilters, CategoryStatus } from "./CategoryFilters"
import { ExportButton } from "../data-viewer/export-button"

// Months array for date selection
const months = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 1).toString(),
  label: new Date(0, i).toLocaleString('default', { month: 'long' })
}));

// Date formatting utility
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString || "-";
    }
    return date.toLocaleDateString("en-GB", {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateString || "-";
  }
};

interface DataViewerContentProps {
  companies: EnrichedCompany[]
  availableYears: number[]
}

export default function DataViewerContent({ companies, availableYears }: DataViewerContentProps) {
  const [companySearch, setCompanySearch] = useState("");
  const [filterItRegistered, setFilterItRegistered] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [fromMonth, setFromMonth] = useState("");
  const [fromYear, setFromYear] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [toYear, setToYear] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<EnrichedCompany | null>(null);
  const [companyItReturns, setCompanyItReturns] = useState<CompanyItReturnListings[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryStatuses, setCategoryStatuses] = useState<Record<string, CategoryStatus>>({ 
    acc: 'active', 
    audit_tax: 'active', 
    cps_sheria: 'active', 
    imm: 'active' 
  });
  const [stats, setStats] = useState({
    totalReturns: 0,
    onTimeReturns: 0,
    lateReturns: 0
  });

  const isFilingLate = (returnData: CompanyItReturnListings): boolean => {
    const returnPeriod = returnData.listing_data?.return_period_to 
      ? new Date(returnData.listing_data.return_period_to) 
      : returnData.listing_data?.return_period_from 
        ? new Date(returnData.listing_data.return_period_from) 
        : new Date();
    
    const filingDateObj = returnData.listing_data?.date_of_filing 
      ? new Date(returnData.listing_data.date_of_filing) 
      : new Date();
    
    // For IT returns, deadline is typically 90 days after the end of the return period
    const deadline = new Date(returnPeriod);
    deadline.setDate(deadline.getDate() + 90);
    return filingDateObj > deadline;
  };

  const prepareSummaryData = useCallback((): any => {
    return {
      companyName: selectedCompany?.company_name || "",
      kraPin: selectedCompany?.kra_pin || "",
      period: `${months[parseInt(fromMonth) - 1]?.label || ''} ${fromYear} to ${months[parseInt(toMonth) - 1]?.label || ''} ${toYear}`,
      returns: companyItReturns.map(returnData => ({
        period: formatDate(returnData.listing_data?.return_period_to || returnData.listing_data?.return_period_from || ''),
        filingDate: formatDate(returnData.listing_data?.date_of_filing || ''),
        status: returnData.listing_data?.date_of_filing ? (isFilingLate(returnData) ? 'Late' : 'On Time') : 'Not Filed',
        acknowledgementNo: returnData.listing_data?.acknowledgement_no || '',
        returnFrom: formatDate(returnData.listing_data?.return_period_from),
        returnTo: formatDate(returnData.listing_data?.return_period_to)
      }))
    };
  }, [selectedCompany, companyItReturns, fromMonth, fromYear, toMonth, toYear]);

  const calculateStats = useCallback(() => {
    const totalReturns = companyItReturns.length;
    const onTimeReturns = companyItReturns.filter(returnData => 
      returnData.listing_data?.date_of_filing && !isFilingLate(returnData)).length;
    const lateReturns = companyItReturns.filter(returnData => 
      returnData.listing_data?.date_of_filing && isFilingLate(returnData)).length;

    setStats({
      totalReturns,
      onTimeReturns,
      lateReturns
    });
  }, [companyItReturns]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchesSearch = company.company_name.toLowerCase().includes(companySearch.toLowerCase()) || 
                        company.kra_pin?.toLowerCase().includes(companySearch.toLowerCase()) || 
                        company.income_tax_company_status.toLowerCase().includes(companySearch.toLowerCase());
      const matchesCategory = selectedCategories.length === 0 || 
                            selectedCategories.some(cat => company.categoryStatus[cat] === 'active');
      const matchesITStatus = !filterItRegistered || company.income_tax_company_status === 'Registered';
      return matchesSearch && matchesCategory && matchesITStatus;
    });
  }, [companies, companySearch, selectedCategories, filterItRegistered]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const handleCategoryToggle = (categoryKey: string) => {
    if (categoryKey === 'all') {
      setSelectedCategories([]);
      return;
    }
    setSelectedCategories(prev =>
      prev.includes(categoryKey)
        ? prev.filter(k => k !== categoryKey)
        : [...prev, categoryKey]
    );
  };

  const handleCategoryStatusChange = (categoryKey: string, status: CategoryStatus) => {
    setCategoryStatuses(prev => ({ ...prev, [categoryKey]: status }));
  };

  useEffect(() => {
    if (selectedCompany) {
      loadCompanyData()
    }
  }, [selectedCompany, fromYear, fromMonth, toYear, toMonth])

  async function loadCompanyData() {
    if (!selectedCompany) return;

    setLoading(true);
    try {
      const data = await getFilteredCompanyDataAction({
        companyId: selectedCompany.id,
        fromYear: parseInt(fromYear),
        fromMonth: parseInt(fromMonth),
        toYear: parseInt(toYear),
        toMonth: parseInt(toMonth),
      });
      setCompanyItReturns(data.itReturns || []);
    } catch (error) {
      console.error("Error loading company IT data:", error);
      setCompanyItReturns([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1">
      {/* Left Sidebar */}
      <div className="w-80 border-r bg-gray-50/50 p-4 overflow-y-auto">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Companies
            </h2>
            <p className="text-sm text-muted-foreground">Select a company to view detailed data</p>
          </div>
          
          <Card>
            <CardContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="it-registered-filter" className="text-sm font-medium">IT Registered Only</Label>
                <Switch 
                  id="it-registered-filter" 
                  checked={filterItRegistered} 
                  onCheckedChange={setFilterItRegistered} 
                />
              </div>
              <CategoryFilters 
                selectedCategories={selectedCategories} 
                categoryStatuses={categoryStatuses} 
                onCategoryToggle={handleCategoryToggle} 
                onStatusChange={handleCategoryStatusChange} 
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="from-month" className="text-sm font-medium">From</Label>
                  <div className="flex space-x-2">
                    <Select value={fromMonth} onValueChange={setFromMonth}>
                      <SelectTrigger>
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map(month => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={fromYear} onValueChange={setFromYear}>
                      <SelectTrigger>
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="to-month" className="text-sm font-medium">To</Label>
                  <div className="flex space-x-2">
                    <Select value={toMonth} onValueChange={setToMonth}>
                      <SelectTrigger>
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map(month => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={toYear} onValueChange={setToYear}>
                      <SelectTrigger>
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col space-y-2">
                <Input
                  placeholder="Search companies..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                />
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredCompanies.map((company) => (
                    <Button
                      key={company.id}
                      variant={selectedCompany?.id === company.id ? "default" : "outline"}
                      className="w-full justify-start gap-2"
                      onClick={() => setSelectedCompany(company)}
                    >
                      <Building2 className="h-4 w-4" />
                      <span className="flex-1 truncate text-left">{company.company_name}</span>
                      <Badge variant="outline" className="ml-2">
                        {company.income_tax_company_status}
                      </Badge>
                    </Button>
                  ))}
                  {filteredCompanies.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No companies found matching your criteria
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{selectedCompany?.company_name || "Select a Company"}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedCompany?.kra_pin || "No PIN selected"}
            </p>
          </div>
          {selectedCompany && (
            <ExportButton
              data={prepareSummaryData()}
              filename={`it-returns-${selectedCompany?.company_name?.replace(/\s+/g, '_') || 'company'}-${fromYear}-${fromMonth}-${toYear}-${toMonth}.xlsx`}
              type="section-data"
              company={selectedCompany}
            />
          )}
        </div>

        <div className="p-4 space-y-4">
          {selectedCompany ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Returns</p>
                        <p className="text-2xl font-bold">{stats.totalReturns}</p>
                      </div>
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">On Time</p>
                        <p className="text-2xl font-bold text-green-600">{stats.onTimeReturns}</p>
                      </div>
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Late</p>
                        <p className="text-2xl font-bold text-red-600">{stats.lateReturns}</p>
                      </div>
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="return-summary" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="return-summary">Return Summary</TabsTrigger>
                  <TabsTrigger value="detailed-view">Detailed View</TabsTrigger>
                </TabsList>

                <TabsContent value="return-summary" className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead>Filing Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyItReturns.length > 0 ? (
                          companyItReturns.map((returnData) => (
                            <TableRow key={returnData.id}>
                              <TableCell>
                                {formatDate(returnData.listing_data?.return_period_to || returnData.listing_data?.return_period_from || '')}
                              </TableCell>
                              <TableCell>{formatDate(returnData.listing_data?.date_of_filing || '')}</TableCell>
                              <TableCell>
                                {returnData.listing_data?.date_of_filing ? (
                                  isFilingLate(returnData) ? (
                                    <Badge variant="destructive">Late</Badge>
                                  ) : (
                                    <Badge variant="default">On Time</Badge>
                                  )
                                ) : (
                                  <Badge variant="outline">Not Filed</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // Handle view details
                                    console.log('View details for:', returnData.id);
                                  }}
                                >
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              {loading ? "Loading..." : "No return data found for the selected period"}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="detailed-view" className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyItReturns.length > 0 ? (
                          companyItReturns.flatMap((returnData, index) => [
                            <TableRow key={`${returnData.id}-period`}>
                              <TableCell className="font-medium">Return Period {index + 1}</TableCell>
                              <TableCell>
                                {formatDate(returnData.listing_data?.return_period_from)} - {formatDate(returnData.listing_data?.return_period_to)}
                              </TableCell>
                            </TableRow>,
                            <TableRow key={`${returnData.id}-filing`}>
                              <TableCell className="font-medium">Filing Date {index + 1}</TableCell>
                              <TableCell>{formatDate(returnData.listing_data?.date_of_filing)}</TableCell>
                            </TableRow>,
                            <TableRow key={`${returnData.id}-ack`}>
                              <TableCell className="font-medium">Acknowledgement No {index + 1}</TableCell>
                              <TableCell>{returnData.listing_data?.acknowledgement_no || '-'}</TableCell>
                            </TableRow>
                          ])
                        ) : (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                              {loading ? "Loading..." : "No detailed data available for the selected period"}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Company Selected</h3>
              <p className="text-muted-foreground">
                Please select a company from the sidebar to view IT return data
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}