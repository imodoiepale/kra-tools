"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, TaxEntry } from "./components/data-table"

const companies = [
  { id: 1, name: "AKASH BEARING" },
  { id: 2, name: "Company B" },
  { id: 3, name: "Company C" },
]

const generateRandomDate = (year: string, month: string) => {
  const paid = Math.random() > 0.5
  if (!paid) return null
  
  const day = Math.floor(Math.random() * 28) + 1
  return `${year}-${month}-${String(day).padStart(2, '0')}`
}

const generateYearData = (year: string): TaxEntry[] => {
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
  return months.map((monthNum, index) => ({
    month: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][index],
    paye: {
      amount: index < 7 ? 4500 : 6400,
      date: generateRandomDate(year, monthNum)
    },
    housingLevy: {
      amount: index < 7 ? 800 : 1200,
      date: generateRandomDate(year, monthNum)
    },
    nita: {
      amount: index < 7 ? 300 : 400,
      date: generateRandomDate(year, monthNum)
    },
    shif: {
      amount: index < 7 ? 1000 : 1500,
      date: generateRandomDate(year, monthNum)
    },
    nssf: {
      amount: index < 7 ? 600 : 900,
      date: generateRandomDate(year, monthNum)
    }
  }))
}

const reportData: Record<string, TaxEntry[]> = {
  "2024": generateYearData("2024"),
  "2023": generateYearData("2023"),
  "2022": generateYearData("2022"),
  "2021": generateYearData("2021"),
  "2020": generateYearData("2020"),
  "2019": generateYearData("2019"),
  "2018": generateYearData("2018"),
  "2017": generateYearData("2017"),
}

const taxTypes = [
  { id: 'paye', name: 'PAYE' },
  { id: 'housingLevy', name: 'Housing Levy' },
  { id: 'nita', name: 'NITA' },
  { id: 'shif', name: 'SHIF' },
  { id: 'nssf', name: 'NSSF' }
] as const

export default function CompanyReports() {
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const [selectedTaxType, setSelectedTaxType] = useState<typeof taxTypes[number]['id']>('paye')
  const years = Object.keys(reportData).sort().reverse()
  const selectedCompanyName = companies.find(c => c.id === selectedCompany)?.name || ""

  const YearlyView = ({ year }: { year: string }) => (
    <DataTable 
      data={reportData[year]} 
      title={`Year ${year}`}
    />
  )

  return (
    <div className="flex h-screen max-h-screen">
      <div className="w-64 border-r p-4">
        <h2 className="font-semibold mb-4">Companies</h2>
        <ScrollArea className="h-[calc(100vh-8rem)]">
          {companies.map((company) => (
            <Card
              key={company.id}
              className={`p-4 mb-2 cursor-pointer hover:bg-muted/50 ${
                selectedCompany === company.id ? "bg-muted" : ""
              }`}
              onClick={() => setSelectedCompany(company.id)}
            >
              {company.name}
            </Card>
          ))}
        </ScrollArea>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {selectedCompany && (
          <>
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold">{selectedCompanyName}</h2>
            </div>

            <Tabs defaultValue="yearly" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="yearly">Yearly View</TabsTrigger>
                <TabsTrigger value="detailed">Detailed View</TabsTrigger>
              </TabsList>
              <TabsContent value="yearly" className="space-y-8">
                {years.slice(0, 2).map(year => (
                  <YearlyView key={year} year={year} />
                ))}
              </TabsContent>
              <TabsContent value="detailed" className="space-y-8">
                <div className="border-b pb-4">
                  <TabsList>
                    {taxTypes.map(tax => (
                      <TabsTrigger
                        key={tax.id}
                        value={tax.id}
                        onClick={() => setSelectedTaxType(tax.id)}
                        className={selectedTaxType === tax.id ? "bg-primary text-primary-foreground" : ""}
                      >
                        {tax.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                <DataTable
                  data={reportData["2024"]}
                  taxType={selectedTaxType}
                  yearlyData={reportData}
                  isHorizontalView={true}
                  title={`${taxTypes.find(t => t.id === selectedTaxType)?.name} History`}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}