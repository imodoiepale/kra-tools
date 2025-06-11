// app/filed-vat/page.tsx
import { Suspense } from "react"
import Link from "next/link"
import { ArrowUpRight, BarChart3, Clock, Download, FileText, Filter, RefreshCw, Settings, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardStatsClient } from "@/components/data-viewer/dashboard-stats"

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
          <Link href="/filed-vat/extraction">
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
          </nav>
        </aside>

        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <Suspense fallback={<div>Loading dashboard stats...</div>}>
            <DashboardStatsClient />
          </Suspense>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Access key features and data</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Link href="/filed-vat/data-viewer">
                  <Button variant="outline" className="w-full justify-start h-auto p-4">
                    <div className="text-left">
                      <div className="font-medium">Data Viewer</div>
                      <div className="text-sm text-muted-foreground">Browse company VAT data</div>
                    </div>
                  </Button>
                </Link>
                <Link href="/filed-vat/companies">
                  <Button variant="outline" className="w-full justify-start h-auto p-4">
                    <div className="text-left">
                      <div className="font-medium">Companies</div>
                      <div className="text-sm text-muted-foreground">Manage company list</div>
                    </div>
                  </Button>
                </Link>
                <Link href="/filed-vat/reports">
                  <Button variant="outline" className="w-full justify-start h-auto p-4">
                    <div className="text-left">
                      <div className="font-medium">Reports</div>
                      <div className="text-sm text-muted-foreground">Generate VAT reports</div>
                    </div>
                  </Button>
                </Link>
                <Link href="/filed-vat/extraction">
                  <Button variant="outline" className="w-full justify-start h-auto p-4">
                    <div className="text-left">
                      <div className="font-medium">Extractions</div>
                      <div className="text-sm text-muted-foreground">View extraction history</div>
                    </div>
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Current system information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Database Status</span>
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Environment</span>
                    <span className="text-sm font-medium">Production</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Last Update</span>
                    <span className="text-sm text-muted-foreground">Just now</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/filed-vat/data-viewer" className="w-full">
                  <Button className="w-full">
                    View Data
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}