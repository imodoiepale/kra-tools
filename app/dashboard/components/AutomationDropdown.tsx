"use client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function AutomationDropdown({ onRun, onLogs }: { onRun: () => void; onLogs: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">More</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onRun}>Run Automation</DropdownMenuItem>
        <DropdownMenuItem onClick={onLogs}>View Logs</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
