"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ColumnFilterProps {
  columns: { id: string; name: string }[];
  selectedColumns: string[];
  onColumnChange: (columns: string[]) => void;
  showDetails?: boolean;
  onToggleDetails?: () => void;
  showTotals?: boolean;
  onToggleTotals?: () => void;
  viewMode: "table" | "overall";
  onViewModeChange: (mode: "table" | "overall") => void;
}

export function ColumnFilter({
  columns,
  selectedColumns,
  onColumnChange,
  showDetails,
  onToggleDetails,
  showTotals,
  onToggleTotals,
  viewMode,
  onViewModeChange,
}: ColumnFilterProps) {
  const [open, setOpen] = React.useState(false);

  const toggleColumn = (columnId: string) => {
    if (selectedColumns.includes(columnId)) {
      onColumnChange(selectedColumns.filter((id) => id !== columnId));
    } else {
      onColumnChange([...selectedColumns, columnId]);
    }
  };

  const getButtonColor = (id: string) => {
    switch (id) {
      case "paye":
        return "bg-blue-100 hover:bg-blue-200 text-blue-800";
      case "housingLevy":
        return "bg-purple-100 hover:bg-purple-200 text-purple-800";
      case "nita":
        return "bg-green-100 hover:bg-green-200 text-green-800";
      case "shif":
        return "bg-orange-100 hover:bg-orange-200 text-orange-800";
      case "nssf":
        return "bg-red-100 hover:bg-red-200 text-red-800";
      default:
        return "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-w-[200px] justify-between bg-[#1e4d7b] text-white hover:bg-[#2a5a8c] hover:text-white">
            Select Taxes ({selectedColumns.length} selected)
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search taxes..." />
            <CommandEmpty>No tax found.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  onSelect={() => toggleColumn(column.id)}
                  className={cn(
                    selectedColumns.includes(column.id) &&
                      getButtonColor(column.id)
                  )}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedColumns.includes(column.id)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {column.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        onClick={onToggleDetails}
        className={cn(
          "bg-[#1e4d7b] text-white hover:bg-[#2a5a8c] hover:text-white",
          showDetails && "bg-[#2a5a8c]"
        )}>
        Column Details {showDetails ? "(All)" : "(None)"}
      </Button>

      <Button
        variant="outline"
        onClick={onToggleTotals}
        className={cn(
          "bg-[#1e4d7b] text-white hover:bg-[#2a5a8c] hover:text-white",
          !showTotals && "bg-[#2a5a8c]"
        )}>
        {showTotals ? "Hide Totals" : "Show Totals"}
      </Button>

      <Button
        variant="outline"
        onClick={() =>
          onViewModeChange(viewMode === "table" ? "overall" : "table")
        }
        className={cn(
          "bg-[#1e4d7b] text-white hover:bg-[#2a5a8c] hover:text-white",
          viewMode === "overall" && "bg-[#2a5a8c]"
        )}>
        {viewMode === "table" ? "Overall View" : "Table View"}
      </Button>
    </div>
  );
}
