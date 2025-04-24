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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ColumnFilterProps {
  columns: { id: string; name: string }[];
  selectedColumns: string[];
  onColumnChange: (columns: string[]) => void;
  selectedSubColumns: (
    | "amount"
    | "date"
    | "status"
    | "bank"
    | "payMode"
    | "all"
  )[];
  onSubColumnChange: (
    subColumns: ("amount" | "date" | "status" | "bank" | "payMode" | "all")[]
  ) => void;
  showTotals?: boolean;
  onToggleTotals?: () => void;
  viewMode: "table" | "overall";
  onViewModeChange: (mode: "table" | "overall") => void;
}

export function ColumnFilter({
  columns,
  selectedColumns,
  onColumnChange,
  selectedSubColumns,
  onSubColumnChange,
  showTotals,
  onToggleTotals,
  viewMode,
  onViewModeChange,
}: ColumnFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  const filteredColumns = React.useMemo(() => {
    if (!searchValue) {
      return columns;
    }
    return columns.filter((column) =>
      column.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [columns, searchValue]);

  const toggleColumn = (columnId: string) => {
    if (selectedColumns.includes(columnId)) {
      // Don't allow deselecting if it's the last column
      if (selectedColumns.length > 1) {
        onColumnChange(selectedColumns.filter((id) => id !== columnId));
      }
    } else {
      onColumnChange([...selectedColumns, columnId]);
    }
  };

  const toggleSubColumn = (
    subColumn: "amount" | "date" | "status" | "bank" | "payMode" | "all"
  ) => {
    if (subColumn === "all") {
      onSubColumnChange(["all"]);
      return;
    }

    if (selectedSubColumns.includes("all")) {
      onSubColumnChange([subColumn]);
      return;
    }

    if (selectedSubColumns.includes(subColumn)) {
      if (selectedSubColumns.length > 1) {
        onSubColumnChange(
          selectedSubColumns.filter((col) => col !== subColumn)
        );
      }
    } else {
      onSubColumnChange([...selectedSubColumns, subColumn]);
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
      {/* Tax Fields Dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-w-[200px] justify-between bg-[#1e4d7b] text-white hover:bg-[#2a5a8c] hover:text-white">
            Taxes ({selectedColumns.length} selected)
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput
              placeholder="Search taxes..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandEmpty>No tax found.</CommandEmpty>
            <CommandGroup>
              {filteredColumns.map((column) => (
                <CommandItem
                  key={column.id}
                  onSelect={() => {
                    toggleColumn(column.id);
                    const event = window.event;
                    if (event) {
                      event.preventDefault();
                    }
                  }}
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

      {/* Column Details Dropdown */}
      <DropdownMenu open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="min-w-[150px] justify-between bg-[#1e4d7b] text-white hover:bg-[#2a5a8c] hover:text-white">
            Tax Fields ({selectedSubColumns.length} selected)
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[180px]"
          onCloseAutoFocus={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}>
          <div className="px-2 py-1.5 text-sm font-semibold border-b">
            All Fields
          </div>
          <DropdownMenuCheckboxItem
            checked={selectedSubColumns.includes("all")}
            onCheckedChange={() => toggleSubColumn("all")}
            onSelect={(e) => e.preventDefault()}>
            All Details
          </DropdownMenuCheckboxItem>
          <div className="px-2 py-1.5 text-sm font-semibold border-b">
            Individual Fields
          </div>
          <DropdownMenuCheckboxItem
            checked={selectedSubColumns.includes("amount")}
            onCheckedChange={() => toggleSubColumn("amount")}
            onSelect={(e) => e.preventDefault()}>
            Amount
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={selectedSubColumns.includes("date")}
            onCheckedChange={() => toggleSubColumn("date")}
            onSelect={(e) => e.preventDefault()}>
            Pay Date
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={selectedSubColumns.includes("status")}
            onCheckedChange={() => toggleSubColumn("status")}
            onSelect={(e) => e.preventDefault()}>
            Status
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={selectedSubColumns.includes("bank")}
            onCheckedChange={() => toggleSubColumn("bank")}
            onSelect={(e) => e.preventDefault()}>
            Bank
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={selectedSubColumns.includes("payMode")}
            onCheckedChange={() => toggleSubColumn("payMode")}
            onSelect={(e) => e.preventDefault()}>
            Pay Mode
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

     
    </div>
  );
}
