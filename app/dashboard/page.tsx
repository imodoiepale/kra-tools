"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationTable } from "./components/AutomationTable";
import { DashboardHeader } from "./components/DashboardHeader";
import { AutomationFilters } from "./components/AutomationFilters";
import { useAutomations } from "./hooks/useAutomations";
import { AutomationType } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardStats } from "./components/DashboardStats";

export default function DashboardPage() {
  const {
    filteredAutomations,
    automationTypes,
    filterByType,
    filterByStatus,
    clearFilters,
    refreshData,
    isRefreshing,
    automationStats
  } = useAutomations();

  const [activeTab, setActiveTab] = useState<AutomationType | "all">("all");

  const handleTabChange = (value: string) => {
    setActiveTab(value as AutomationType | "all");
    if (value === "all") {
      clearFilters();
    } else {
      filterByType(value as AutomationType);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <DashboardHeader refreshData={refreshData} isRefreshing={isRefreshing} />

      <div className="flex-1 container py-4 space-y-6 overflow-auto">
        {/* <DashboardStats stats={automationStats} /> */}

        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange}>
              <div className="flex justify-between items-center mb-4">
                <TabsList>
                  <TabsTrigger value="all">All Automations</TabsTrigger>
                  {automationTypes.map((type) => (
                    <TabsTrigger key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* <AutomationFilters
                onFilterByStatus={filterByStatus}
                onClearFilters={clearFilters}
              /> */}

              <TabsContent value="all" className="mt-4">
                <AutomationTable automations={filteredAutomations} />
              </TabsContent>

              {automationTypes.map((type) => (
                <TabsContent key={type} value={type} className="mt-4">
                  <AutomationTable
                    automations={filteredAutomations.filter(a => a.type === type)}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}