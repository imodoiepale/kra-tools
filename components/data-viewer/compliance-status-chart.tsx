"use client"

import { useEffect, useState } from "react"
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { getDashboardStats } from "@/lib/data-viewer/data-fetchers"

export function ComplianceStatusChart() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const stats = await getDashboardStats()
        const chartData = [
          { name: "Compliant", value: stats.totalCompanies - stats.missingReturns, color: "#22c55e" },
          { name: "Missing Returns", value: stats.missingReturns, color: "#ef4444" },
          { name: "Nil Returns", value: stats.nilReturns, color: "#6b7280" },
        ]
        setData(chartData)
      } catch (error) {
        console.error("Error fetching compliance data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div className="h-[300px] flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${value} companies`, ""]}
            contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
