import { Suspense } from "react"
import Link from "next/link"
import { ArrowUpRight, BarChart3, Clock, Download, FileText, Filter, RefreshCw, Settings, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardStats } from "@/components/data-viewer/dashboard-stats"
import { ExtractionStatusCard } from "@/components/data-viewer/extraction-status-card"
import { ComplianceStatusChart } from "@/components/data-viewer/compliance-status-chart"
import { RecentExtractionsTable } from "@/components/data-viewer/recent-extractions-table"
import { FilingTrendsChart } from "@/components/data-viewer/filing-trends-chart"
import { DataSummaryCards } from "@/components/data-viewer/data-summary-cards"

export default function DashboardPage() {

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <span className="text-lg font-semibold">VAT Extraction Dashboard</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Link href="/extraction">
            <Button size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              New Extraction
            </Button>
          </Link>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-[250px] flex-col border-r bg-muted/40 md:flex">
          <nav className="grid gap-2 px-4 py-6">
            <Link href="/filed-vat/" className="flex items-center gap-3 rounded-lg bg-primary px-3 py-2 text-primary-foreground">
              <BarChart3 className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/filed-vat/companies"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Users className="h-5 w-5" />
              <span>Companies</span>
            </Link>
            <Link
              href="/filed-vat/extraction"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RefreshCw className="h-5 w-5" />
              <span>Extractions</span>
            </Link>
            <Link
              href="/filed-vat/reports"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <FileText className="h-5 w-5" />
              <span>Reports</span>
            </Link>
            <Link
              href="/filed-vat/data-viewer"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <BarChart3 className="h-5 w-5" />
              <span>Data Viewer</span>
            </Link>
            <Link
              href="/filed-vat/report-builder"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-5 w-5" />
              <span>Report Builder</span>
            </Link>
          </nav>
        </aside>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <Suspense fallback={<div>Loading dashboard stats...</div>}>
            <DashboardStats />
          </Suspense>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                  <CardTitle>Filing Trends</CardTitle>
                  <CardDescription>Monthly filing trends across all companies</CardDescription>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pl-2">
                <Suspense fallback={<div>Loading filing trends...</div>}>
                  <FilingTrendsChart />
                </Suspense>
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
                <CardDescription>Filing status across all companies</CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<div>Loading compliance data...</div>}>
                  <ComplianceStatusChart />
                </Suspense>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Recent Extractions</CardTitle>
                <CardDescription>Latest data extraction activities</CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<div>Loading recent extractions...</div>}>
                  <RecentExtractionsTable />
                </Suspense>
              </CardContent>
              <CardFooter>
                <Link href="/extraction" className="w-full">
                  <Button variant="outline" className="w-full">
                    View All Extractions
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Extraction Status</CardTitle>
                <CardDescription>Current extraction operations</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <ExtractionStatusCard
                  company="System Status"
                  progress={100}
                  status="Ready"
                  startTime="System Ready"
                  estimatedCompletion="Ready for new extractions"
                  isComplete={true}
                />
              </CardContent>
              <CardFooter>
                <Link href="/extraction" className="w-full">
                  <Button variant="outline" className="w-full">
                    Start New Extraction
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>

          <Tabs defaultValue="data-summary">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="data-summary">Data Summary</TabsTrigger>
                <TabsTrigger value="alerts">Alerts & Notifications</TabsTrigger>
                <TabsTrigger value="data-quality">Data Quality</TabsTrigger>
              </TabsList>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
            <TabsContent value="data-summary" className="mt-4">
              <Suspense fallback={<div>Loading data summary...</div>}>
                <DataSummaryCards />
              </Suspense>
            </TabsContent>
            <TabsContent value="alerts" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Alerts & Notifications</CardTitle>
                  <CardDescription>Important alerts and system notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 rounded-lg border p-4">
                      <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/20">
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="grid gap-1">
                        <p className="text-sm font-medium">System Ready</p>
                        <p className="text-sm text-muted-foreground">
                          VAT extraction system is ready for new operations
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Info</span>
                          <span>•</span>
                          <span>System Status</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="data-quality" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Data Quality Metrics</CardTitle>
                  <CardDescription>Quality assessment of extracted data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Completeness</span>
                        <span className="text-sm font-medium">92%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div className="h-full w-[92%] rounded-full bg-green-500" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Accuracy</span>
                        <span className="text-sm font-medium">87%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div className="h-full w-[87%] rounded-full bg-blue-500" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Validation Status</span>
                        <span className="text-sm font-medium">78%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div className="h-full w-[78%] rounded-full bg-amber-500" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Data Consistency</span>
                        <span className="text-sm font-medium">95%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div className="h-full w-[95%] rounded-full bg-green-500" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
