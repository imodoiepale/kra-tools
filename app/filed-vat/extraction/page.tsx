import { ArrowLeft, Calendar, Clock, Download, Filter, RefreshCw, Search } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getVatReturnDetails, getCompanies } from "@/lib/data-viewer/data-fetchers"

export default async function ExtractionPage() {
  const [vatReturns, companies] = await Promise.all([
    getVatReturnDetails(undefined, undefined, undefined, 50),
    getCompanies(),
  ])

  // Calculate stats from real data
  const activeExtractions = 0 // No active extractions in static data
  const completedToday = vatReturns.filter((r) => {
    const today = new Date()
    const extractionDate = new Date(r.extraction_timestamp)
    return extractionDate.toDateString() === today.toDateString()
  }).length

  const successfulExtractions = vatReturns.filter((r) => r.processing_status === "completed").length
  const totalExtractions = vatReturns.length
  const successRate = totalExtractions > 0 ? Math.round((successfulExtractions / totalExtractions) * 100) : 0

  // Calculate average duration (mock data since we don't have duration in DB)
  const avgDuration = "4m 12s"

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <Link href="/filed-vat" className="flex items-center gap-2 text-lg font-semibold">
          <ArrowLeft className="h-5 w-5" />
          Back to Dashboard
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            New Extraction
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Extractions</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeExtractions}</div>
              <p className="text-xs text-muted-foreground">No active extractions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedToday}</div>
              <p className="text-xs text-muted-foreground">{successfulExtractions} total successful</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgDuration}</div>
              <p className="text-xs text-muted-foreground">Estimated average</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate}%</div>
              <p className="text-xs text-muted-foreground">Based on {totalExtractions} extractions</p>
            </CardContent>
          </Card>
        </div>
        <div className="flex items-center gap-4">
          <Input placeholder="Search extractions..." className="max-w-sm" type="search" />
          <Button variant="outline" size="icon">
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>
        </div>
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Extractions</CardTitle>
                <CardDescription>Currently running extraction operations</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="text-center py-8 text-muted-foreground">No active extractions at the moment</div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="completed" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                  <CardTitle>Completed Extractions</CardTitle>
                  <CardDescription>Recent extraction operations from database</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="ml-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Company</th>
                        <th className="pb-2 font-medium">Period</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Completed</th>
                        <th className="pb-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vatReturns.slice(0, 20).map((vatReturn, i) => {
                        const company = companies.find((c) => c.id === vatReturn.company_id)
                        const companyName = company?.company_name || `Company ${vatReturn.company_id}`

                        return (
                          <tr key={i} className="border-b">
                            <td className="py-3">{companyName}</td>
                            <td className="py-3">
                              {new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-3">
                              <div
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${vatReturn.processing_status === "completed"
                                    ? "bg-green-100 text-green-700 border-green-200"
                                    : "bg-red-100 text-red-700 border-red-200"
                                  }`}
                              >
                                {vatReturn.processing_status === "completed" ? "Success" : "Failed"}
                              </div>
                            </td>
                            <td className="py-3">{vatReturn.is_nil_return ? "Nil Return" : "Data Return"}</td>
                            <td className="py-3 text-muted-foreground">
                              {new Date(vatReturn.extraction_timestamp).toLocaleDateString()}
                            </td>
                            <td className="py-3">
                              <Link href={`/companies/${vatReturn.company_id}`}>
                                <Button variant="ghost" size="sm">
                                  View
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="scheduled" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Extractions</CardTitle>
                <CardDescription>Upcoming extraction operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">No scheduled extractions configured</div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
