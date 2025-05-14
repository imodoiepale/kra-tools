"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { automationTypes } from "../hooks/useAutomations";
import { AutomationTable } from "./AutomationTable";

export function AutomationTabs() {
  return (
    <Tabs defaultValue={automationTypes[0].type} className="w-full">
      <TabsList className="flex w-full overflow-x-auto whitespace-nowrap">
        {automationTypes.map((t) => (
          <TabsTrigger key={t.type} value={t.type} className="text-xs px-3 py-1">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {automationTypes.map((t) => (
        <TabsContent key={t.type} value={t.type} className="pt-4">
          <AutomationTable automationType={t.type} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
