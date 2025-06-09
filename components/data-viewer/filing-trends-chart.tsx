"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { getFilingTrends } from "@/lib/data-viewer/data-fetchers"

export function FilingTrendsChart() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const trends = await getFilingTrends()
        setData(trends)
      } catch (error) {
        console.error("Error fetching filing trends:", error)
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
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e2e8f0" }} />
          <Legend />
          <Bar dataKey="onTime" name="On Time" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="late" name="Late" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="missing" name="Missing" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="nil" name="Nil Returns" stackId="a" fill="#6b7280" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
