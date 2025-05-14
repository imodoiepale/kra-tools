"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAutomationDetails } from "../hooks/hooks";
import { Button } from "@/components/ui/button";

export function AutomationDialog({ automationId, onClose }: { automationId: string | null, onClose: () => void }) {
  const automation = useAutomationDetails(automationId);
  return (
    <Dialog open={!!automationId} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{automation?.name || "Automation Details"}</DialogTitle>
        </DialogHeader>
        {!automation && <div className="text-xs text-gray-400">Loading...</div>}
        {automation && (
          <div className="space-y-2 text-xs">
            <div><b>Type:</b> {automation.type}</div>
            <div><b>Status:</b> {automation.status}</div>
            <div><b>Last Run:</b> {automation.lastRun ? new Date(automation.lastRun).toLocaleString() : '-'}</div>
            <div><b>Companies:</b> {automation.companies?.map(c => c.name).join(", ")}</div>
            <div className="pt-2">
              <Button size="sm" variant="default">Run Automation</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
