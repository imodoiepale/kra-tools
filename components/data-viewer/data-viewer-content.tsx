"use client"

import { useState, useEffect, useMemo } from "react"
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
import { VatSectionViewer } from "@/components/data-viewer/vat-section-viewer"
import { ReturnListingsTable } from "@/components/data-viewer/return-listings-table"
import { ExportButton } from "@/components/data-viewer/export-button"
import { CategoryFilters, CategoryStatus } from "./CategoryFilters"
import { getFilteredCompanyDataAction } from "@/app/filed-vat/data-viewer/actions"
import type { EnrichedCompany, VatReturnDetails, CompanyVatReturnListings } from "@/lib/data-viewer/supabase"

interface DataViewerContentProps {
  companies: EnrichedCompany[]
  availableYears: number[]
}

export function DataViewerContent({ companies, availableYears }: DataViewerContentProps) {
  const [selectedCompany, setSelectedCompany] = useState<EnrichedCompany | null>(null)
  const [companySearch, setCompanySearch] = useState("")
  const [filterVatRegistered, setFilterVatRegistered] = useState(true)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['acc']);
  const [categoryStatuses, setCategoryStatuses] = useState<Record<string, CategoryStatus>>({ acc: 'active' });

  const [fromYear, setFromYear] = useState<string>(availableYears[0]?.toString() || new Date().getFullYear().toString())
  const [fromMonth, setFromMonth] = useState<string>("1")
  const [toYear, setToYear] = useState<string>(availableYears[0]?.toString() || new Date().getFullYear().toString())
  const [toMonth, setToMonth] = useState<string>("12")

  const [companyVatReturns, setCompanyVatReturns] = useState<VatReturnDetails[]>([])
  const [companyListings, setCompanyListings] = useState<CompanyVatReturnListings[]>([])
  const [loading, setLoading] = useState(false)

  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      if (filterVatRegistered && company.vat_status !== 'Registered') {
        return false;
      }

      const searchTerm = companySearch.toLowerCase();
      if (searchTerm && !(company.company_name.toLowerCase().includes(searchTerm) || (company.kra_pin && company.kra_pin.toLowerCase().includes(searchTerm)))) {
        return false;
      }

      if (selectedCategories.length === 0) {
        return true;
      }

      return selectedCategories.some(categoryKey => {
        const statusFilter = categoryStatuses[categoryKey] || 'all';
        if (statusFilter === 'all') return true;

        const companyStatus = company.categoryStatus[categoryKey as keyof typeof company.categoryStatus];
        return statusFilter === companyStatus;
      });
    });
  }, [companies, companySearch, filterVatRegistered, selectedCategories, categoryStatuses]);

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

  const handleStatusChange = (categoryKey: string, status: CategoryStatus) => {
    setCategoryStatuses(prev => ({ ...prev, [categoryKey]: status }));
  };

  useEffect(() => {
    if (selectedCompany && !filteredCompanies.some(c => c.id === selectedCompany.id)) {
      setSelectedCompany(null);
    }
  }, [filteredCompanies, selectedCompany]);

  useEffect(() => {
    if (!selectedCompany) {
      setCompanyVatReturns([]);
      setCompanyListings([]);
      return;
    }
    const loadCompanyData = async () => {
      setLoading(true);
      try {
        const { vatReturns, listings } = await getFilteredCompanyDataAction({
          companyId: selectedCompany.id,
          fromYear: Number.parseInt(fromYear),
          fromMonth: Number.parseInt(fromMonth),
          toYear: Number.parseInt(toYear),
          toMonth: Number.parseInt(toMonth),
        });
        setCompanyVatReturns(vatReturns);
        setCompanyListings(listings);
      } catch (error) {
        console.error("Error loading company data:", error);
        setCompanyVatReturns([]);
        setCompanyListings([]);
      } finally {
        setLoading(false);
      }
    };
    loadCompanyData();
  }, [selectedCompany, fromYear, fromMonth, toYear, toMonth]);

  const months = [
    { value: "1", label: "January" }, { value: "2", label: "February" }, { value: "3", label: "March" },
    { value: "4", label: "April" }, { value: "5", label: "May" }, { value: "6", label: "June" },
    { value: "7", label: "July" }, { value: "8", label: "August" }, { value: "9", label: "September" },
    { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", { style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const FormattedCurrencyCell = ({ value, isNilReturn }: { value: number; isNilReturn: boolean }) => {
    if (isNilReturn) return <span>-</span>;
    const textColorClass = value < 0 ? "text-red-600 font-semibold" : "";
    const formattedValue = formatCurrency(value);
    return <span className={textColorClass}>{formattedValue}</span>;
  };

  const formatDate = (dateString: string) => {
    try {
      if (dateString.includes("/")) {
        const [day, month, year] = dateString.split("/");
        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      }
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString || "-";
    }
  };

  const parseAmount = (value: any): number => {
    if (value === null || value === undefined || value === "" || value === "-") return 0;
    const cleanValue = String(value).replace(/[^\d.-]/g, "").replace(/,/g, "");
    const parsed = Number.parseFloat(cleanValue);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const isFilingLate = (vatReturn: VatReturnDetails, filingDate: string) => {
    if (!filingDate) return false;
    try {
      const [day, month, year] = filingDate.split("/");
      const filing = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day));
      const returnPeriod = new Date(vatReturn.year, vatReturn.month - 1);
      const deadline = new Date(returnPeriod.getFullYear(), returnPeriod.getMonth() + 1, 20);
      return filing > deadline;
    } catch (error) {
      return false;
    }
  };

  const extractSectionOValues = (vatReturn: VatReturnDetails) => {
    const sectionO = vatReturn.section_o;
    if (!sectionO?.data || !Array.isArray(sectionO.data)) return { outputVat6: 0, inputVat12: 0, totalVatWithholding: 0, creditBroughtForward: 0, netVatPayable: 0 };
    let outputVat6 = 0, inputVat12 = 0, totalVatWithholding = 0, creditBroughtForward = 0, netVatPayable = 0;
    sectionO.data.forEach((row: any) => {
      const srNo = String(row["Sr.No."] || "").trim();
      const amount = parseAmount(row["Amount (Ksh)"]);
      const descriptions = (row["Descriptions"] || "").toLowerCase();
      switch (srNo) {
        case "13": if (descriptions.includes("output vat")) outputVat6 = amount; break;
        case "14": if (descriptions.includes("input vat")) inputVat12 = amount; break;
        case "21": if (descriptions.includes("credit brought forward")) creditBroughtForward = amount; break;
        case "22": if (descriptions.includes("vat withholding")) totalVatWithholding = amount; break;
        case "28": if (descriptions.includes("net vat payable") || descriptions.includes("credit carried forward")) netVatPayable = amount; break;
      }
    });
    return { outputVat6, inputVat12, totalVatWithholding, creditBroughtForward, netVatPayable };
  };

  const extractSectionB2Values = (vatReturn: VatReturnDetails) => {
    const sectionB2 = vatReturn.section_b2;
    if (!sectionB2?.data || !Array.isArray(sectionB2.data)) return { salesRegistered: 0, salesNotRegistered: 0 };
    let salesRegistered = 0, salesNotRegistered = 0;
    sectionB2.data.forEach((row: any) => {
      const description = (row["Description"] || "").toLowerCase();
      const vatAmount = parseAmount(row["Amount of VAT (Ksh)"]);
      if (description.includes("customers registered for vat")) salesRegistered = vatAmount;
      else if (description.includes("customers not registered for vat")) salesNotRegistered = vatAmount;
    });
    return { salesRegistered, salesNotRegistered };
  };

  const extractSectionF2Values = (vatReturn: VatReturnDetails) => {
    const sectionF2 = vatReturn.section_f2;
    if (!sectionF2?.data || !Array.isArray(sectionF2.data)) return { purchasesRegistered: 0, purchasesNotRegistered: 0 };
    let purchasesRegistered = 0, purchasesNotRegistered = 0;
    sectionF2.data.forEach((row: any) => {
      const description = (row["Description"] || "").toLowerCase();
      const vatAmount = parseAmount(row["Amount of VAT (Ksh)"]);
      if (description.includes("suppliers registered for vat") && description.includes("local")) purchasesRegistered = vatAmount;
      else if (description.includes("suppliers not registered for vat") && description.includes("import")) purchasesNotRegistered = vatAmount;
    });
    return { purchasesRegistered, purchasesNotRegistered };
  };

  const filingDateMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!companyListings) return map;
    for (const listing of companyListings) {
      if (!listing.listing_data) continue;
      const listingData = listing.listing_data as any;
      let dataArray = Array.isArray(listingData.data) ? listingData.data : Array.isArray(listingData) ? listingData : [];
      for (const row of dataArray) {
        const taxObligation = row["Tax Obligation"] || "";
        const returnPeriodFrom = row["Return Period from"] || "";
        const filingDate = row["Date of Filing"] || "";
        if (!taxObligation.includes("Value Added Tax") || !returnPeriodFrom.includes("/")) continue;
        try {
          const [, month, year] = returnPeriodFrom.split("/");
          const key = `${year}-${parseInt(month)}`;
          if (!map.has(key)) map.set(key, filingDate);
        } catch (e) { }
      }
    }
    return map;
  }, [companyListings]);

  const getFilingDate = (vatReturn: VatReturnDetails) => {
    const key = `${vatReturn.year}-${vatReturn.month}`;
    return filingDateMap.get(key) || null;
  };

  const handleEmailReport = () => {
    alert("Email functionality will be configured later. Report data is ready to be sent.");
  };

  const prepareSummaryData = () => {
    return companyVatReturns.map((vatReturn, index) => {
      const sectionOValues = extractSectionOValues(vatReturn);
      const sectionB2Values = extractSectionB2Values(vatReturn);
      const sectionF2Values = extractSectionF2Values(vatReturn);
      const filingDate = getFilingDate(vatReturn);
      const isLate = filingDate ? isFilingLate(vatReturn, filingDate) : false;
      return {
        "Sr.No.": index + 1, "Company Name": selectedCompany?.company_name || "", "KRA PIN": selectedCompany?.kra_pin || "",
        Period: new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        "Filing Date": filingDate || "-", "Filing Status": isLate ? "Late" : "On Time", "Return Type": vatReturn.is_nil_return ? "Nil" : "Data",
        "Output VAT (6)": vatReturn.is_nil_return ? 0 : sectionOValues.outputVat6, "Input VAT (12)": vatReturn.is_nil_return ? 0 : sectionOValues.inputVat12,
        "VAT Withholding": vatReturn.is_nil_return ? 0 : sectionOValues.totalVatWithholding, "Credit B/F": vatReturn.is_nil_return ? 0 : sectionOValues.creditBroughtForward,
        "Net VAT Payable": vatReturn.is_nil_return ? 0 : sectionOValues.netVatPayable, "Purchases Registered": vatReturn.is_nil_return ? 0 : sectionF2Values.purchasesRegistered,
        "Purchases Not Registered": vatReturn.is_nil_return ? 0 : sectionF2Values.purchasesNotRegistered, "Sales Registered": vatReturn.is_nil_return ? 0 : sectionB2Values.salesRegistered,
        "Sales Not Registered": vatReturn.is_nil_return ? 0 : sectionB2Values.salesNotRegistered,
      };
    });
  };

  const stats = useMemo(() => {
    if (!selectedCompany || companyVatReturns.length === 0) return { totalReturns: 0, nilReturns: 0, dataReturns: 0, totalOutputVat: 0, totalInputVat: 0 };
    const totalReturns = companyVatReturns.length;
    const nilReturns = companyVatReturns.filter((r) => r.is_nil_return).length;
    const dataReturns = totalReturns - nilReturns;
    let totalOutputVat = 0, totalInputVat = 0;
    companyVatReturns.forEach((vatReturn) => {
      if (!vatReturn.is_nil_return) {
        const { outputVat6, inputVat12 } = extractSectionOValues(vatReturn);
        totalOutputVat += outputVat6;
        totalInputVat += inputVat12;
      }
    });
    return { totalReturns, nilReturns, dataReturns, totalOutputVat, totalInputVat };
  }, [companyVatReturns, selectedCompany]);

  return (
    <div className="flex flex-1">
      <div className="w-80 border-r bg-gray-50/50 p-4 overflow-y-auto">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2"><Building2 className="h-5 w-5" />Companies</h2>
            <p className="text-sm text-muted-foreground">Select a company to view detailed data</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Search companies..." value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} className="pl-10" />
          </div>
          <Card>
            {/* <CardHeader className="pb-3"><CardTitle className="text-sm">View Filters</CardTitle></CardHeader> */}
            <CardContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="vat-registered-filter" className="text-sm font-medium">VAT Registered Only</Label>
                <Switch id="vat-registered-filter" checked={filterVatRegistered} onCheckedChange={setFilterVatRegistered} />
              </div>
              <CategoryFilters selectedCategories={selectedCategories} categoryStatuses={categoryStatuses} onCategoryToggle={handleCategoryToggle} onStatusChange={handleStatusChange} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4" />Date Range Filter</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">From Year</label>
                  <Select value={fromYear} onValueChange={setFromYear}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{availableYears.map((year) => (<SelectItem key={year} value={year.toString()}>{year}</SelectItem>))}</SelectContent></Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">From Month</label>
                  <Select value={fromMonth} onValueChange={setFromMonth}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{months.map((month) => (<SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>))}</SelectContent></Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">To Year</label>
                  <Select value={toYear} onValueChange={setToYear}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{availableYears.map((year) => (<SelectItem key={year} value={year.toString()}>{year}</SelectItem>))}</SelectContent></Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">To Month</label>
                  <Select value={toMonth} onValueChange={setToMonth}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{months.map((month) => (<SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>))}</SelectContent></Select>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Companies ({filteredCompanies.length})</span>
              {selectedCompany && (<Button variant="ghost" size="sm" onClick={() => setSelectedCompany(null)} className="text-xs">Clear Selection</Button>)}
            </div>
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {filteredCompanies.map((company) => (
                <button key={company.id} onClick={() => setSelectedCompany(company)} className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedCompany?.id === company.id ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-white border-gray-200 hover:bg-gray-50"}`}>
                  <div className="font-medium text-sm truncate">{company.company_name}</div>
                  <div className="text-xs flex items-center gap-2 text-gray-500 font-mono">
                    {company.kra_pin || 'No KRA PIN'}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${company.vat_status === 'Registered' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      VAT: {company.vat_status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        {!selectedCompany ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Company</h3>
              <p className="text-gray-500">Choose a company from the sidebar to view detailed VAT data and analysis</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{selectedCompany.company_name}</h1>
                <p className="text-muted-foreground">KRA PIN: {selectedCompany.kra_pin}</p>
                <p className="text-sm text-gray-500">Showing data from {months.find((m) => m.value === fromMonth)?.label} {fromYear} to{" "} {months.find((m) => m.value === toMonth)?.label} {toYear}</p>
              </div>
              <div className="flex items-center gap-3">
                {loading && <Badge variant="secondary">Loading...</Badge>}
                <Button onClick={handleEmailReport} variant="outline" size="sm"><Mail className="mr-2 h-4 w-4" />Email Report</Button>
                {selectedCompany && companyVatReturns.length > 0 && (
                  <ExportButton data={prepareSummaryData()} filename={`VAT_Summary_${selectedCompany.company_name.replace(/\s+/g, "_")}`} type="section-data" company={selectedCompany} variant="default" size="sm" />
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Returns</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalReturns}</div><p className="text-xs text-muted-foreground">VAT returns filed</p></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Data Returns</CardTitle><BarChart3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.dataReturns}</div><p className="text-xs text-muted-foreground">With transaction data</p></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Nil Returns</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.nilReturns}</div><p className="text-xs text-muted-foreground">No transaction data</p></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Output VAT</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalOutputVat)}</div><p className="text-xs text-muted-foreground">Total collected</p></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Input VAT</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalInputVat)}</div><p className="text-xs text-muted-foreground">Total claimed</p></CardContent></Card>
            </div>
            <Tabs defaultValue="listings" className="space-y-4">
              <TabsList>
                <TabsTrigger value="listings">Return Summary</TabsTrigger>
                <TabsTrigger value="summary">VAT Sections Summary</TabsTrigger>
                <TabsTrigger value="sections">VAT Sections</TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div><CardTitle>VAT Returns Summary</CardTitle><CardDescription>Data extracted from Section O (Tax Calculation), Section B2 (Sales Totals), Section F2 (Purchases Totals), and Return Summary (Filing Dates)</CardDescription></div>
                      {selectedCompany && companyVatReturns.length > 0 && (<ExportButton data={prepareSummaryData()} filename={`VAT_Summary_${selectedCompany.company_name.replace(/\s+/g, "_")}`} type="section-data" company={selectedCompany} variant="outline" size="sm" />)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="relative h-[600px] w-full overflow-auto border rounded-lg">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background">
                          <TableRow>
                            <TableHead rowSpan={2} className="border-r whitespace-nowrap px-3 py-3 text-left font-medium text-gray-900 border-b">Sr.No.</TableHead>
                            <TableHead rowSpan={2} className="border-r whitespace-nowrap px-3 py-3 text-left font-medium text-gray-900 border-b">Period</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-3 py-2 text-center font-medium text-gray-900 border-b">Filing Date</TableHead>
                            <TableHead rowSpan={2} className="border-r whitespace-nowrap px-3 py-3 text-left font-medium text-gray-900 border-b">Type</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-3 py-2 text-center font-medium text-gray-900 border-b">Output VAT (6)</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-3 py-2 text-center font-medium text-gray-900 border-b">Input VAT (12)</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-3 py-2 text-center font-medium text-gray-900 border-b">VAT Withholding</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-3 py-2 text-center font-medium text-gray-900 border-b">Credit B/F</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-3 py-2 text-center font-medium text-gray-900 border-b">Net VAT Payable</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-3 py-2 text-center font-medium text-gray-900 border-b">Purchases Reg.</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-3 py-2 text-center font-medium text-gray-900 border-b">Purchases Not Reg.</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-3 py-2 text-center font-medium text-gray-900 border-b">Sales Reg.</TableHead>
                            <TableHead className="whitespace-nowrap px-3 py-2 text-center font-medium text-gray-900 border-b">Sales Not Reg.</TableHead>
                          </TableRow>
                          <TableRow>
                            <TableHead className="border-r whitespace-nowrap px-2 py-2 text-center text-xs text-gray-500 border-b bg-gray-50">(Return Summary)</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-2 py-2 text-center text-xs text-gray-500 border-b bg-gray-50">(Section O-13)</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-2 py-2 text-center text-xs text-gray-500 border-b bg-gray-50">(Section O-14)</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-2 py-2 text-center text-xs text-gray-500 border-b bg-gray-50">(Section O-22)</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-2 py-2 text-center text-xs text-gray-500 border-b bg-gray-50">(Section O-21)</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-2 py-2 text-center text-xs text-gray-500 border-b bg-gray-50">(Section O-28)</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-2 py-2 text-center text-xs text-gray-500 border-b bg-gray-50">(Section F2)</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-2 py-2 text-center text-xs text-gray-500 border-b bg-gray-50">(Section F2)</TableHead>
                            <TableHead className="border-r whitespace-nowrap px-2 py-2 text-center text-xs text-gray-500 border-b bg-gray-50">(Section B2)</TableHead>
                            <TableHead className="whitespace-nowrap px-2 py-2 text-center text-xs text-gray-500 border-b bg-gray-50">(Section B2)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyVatReturns.length > 0 ? (
                            companyVatReturns.map((vatReturn, index) => {
                              const sectionOValues = extractSectionOValues(vatReturn);
                              const sectionB2Values = extractSectionB2Values(vatReturn);
                              const sectionF2Values = extractSectionF2Values(vatReturn);
                              const filingDate = getFilingDate(vatReturn);
                              const isLate = filingDate ? isFilingLate(vatReturn, filingDate) : false;
                              return (
                                <TableRow key={vatReturn.id} className="border-b">
                                  <TableCell className="font-medium border-r whitespace-nowrap">{index + 1}</TableCell>
                                  <TableCell className="border-r whitespace-nowrap">{new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</TableCell>
                                  <TableCell className="border-r whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      {filingDate ? (<>{isLate ? <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" /> : <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />}<span className={`font-bold ${isLate ? "text-red-600" : "text-green-600"}`}>{formatDate(filingDate)}</span></>) : (<span className="text-gray-400">-</span>)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="border-r whitespace-nowrap"><Badge variant={vatReturn.is_nil_return ? "secondary" : "default"}>{vatReturn.is_nil_return ? "Nil" : "VAT Filled"}</Badge></TableCell>
                                  <TableCell className="text-right border-r whitespace-nowrap"><FormattedCurrencyCell value={sectionOValues.outputVat6} isNilReturn={vatReturn.is_nil_return} /></TableCell>
                                  <TableCell className="text-right border-r whitespace-nowrap"><FormattedCurrencyCell value={sectionOValues.inputVat12} isNilReturn={vatReturn.is_nil_return} /></TableCell>
                                  <TableCell className="text-right border-r whitespace-nowrap"><FormattedCurrencyCell value={sectionOValues.totalVatWithholding} isNilReturn={vatReturn.is_nil_return} /></TableCell>
                                  <TableCell className="text-right border-r whitespace-nowrap"><FormattedCurrencyCell value={sectionOValues.creditBroughtForward} isNilReturn={vatReturn.is_nil_return} /></TableCell>
                                  <TableCell className="text-right border-r whitespace-nowrap font-bold"><FormattedCurrencyCell value={sectionOValues.netVatPayable} isNilReturn={vatReturn.is_nil_return} /></TableCell>
                                  <TableCell className="text-right border-r whitespace-nowrap"><FormattedCurrencyCell value={sectionF2Values.purchasesRegistered} isNilReturn={vatReturn.is_nil_return} /></TableCell>
                                  <TableCell className="text-right border-r whitespace-nowrap"><FormattedCurrencyCell value={sectionF2Values.purchasesNotRegistered} isNilReturn={vatReturn.is_nil_return} /></TableCell>
                                  <TableCell className="text-right border-r whitespace-nowrap"><FormattedCurrencyCell value={sectionB2Values.salesRegistered} isNilReturn={vatReturn.is_nil_return} /></TableCell>
                                  <TableCell className="text-right whitespace-nowrap"><FormattedCurrencyCell value={sectionB2Values.salesNotRegistered} isNilReturn={vatReturn.is_nil_return} /></TableCell>
                                </TableRow>
                              )
                            })
                          ) : (<TableRow><TableCell colSpan={13} className="h-24 text-center">{loading ? "Loading data..." : "No VAT returns found for the selected period."}</TableCell></TableRow>)}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="sections" className="space-y-4">
                <VatSectionViewer companyId={selectedCompany.id} vatReturns={companyVatReturns} />
              </TabsContent>
              <TabsContent value="listings" className="space-y-4">
                <ReturnListingsTable returnListings={companyListings} company={selectedCompany} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}