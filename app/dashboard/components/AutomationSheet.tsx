"use client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAutomationDetails } from "../hooks/hooks";

export function AutomationSheet({ automationId, open, onClose }: { automationId: string | null, open: boolean, onClose: () => void }) {
  const automation = useAutomationDetails(automationId);
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="max-w-md">
        <SheetHeader>
          <SheetTitle>{automation?.name || "Automation Details"}</SheetTitle>
        </SheetHeader>
        {automation ? (
          <div className="text-xs space-y-2">
            <div><b>Type:</b> {automation.type}</div>
            <div><b>Status:</b> {automation.status}</div>
            <div><b>Companies:</b> {automation.companies?.map(c => c.name).join(", ")}</div>
            {/* Add more details/actions as needed */}
          </div>
        ) : (
          <div className="text-gray-400">Loading...</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
