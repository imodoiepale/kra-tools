"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ColumnFilterProps {
  columns: { id: string; name: string }[]
  selectedColumns: string[]
  onColumnChange: (columns: string[]) => void
}

export function ColumnFilter({ columns, selectedColumns, onColumnChange }: ColumnFilterProps) {
  const [open, setOpen] = React.useState(false)

  const toggleColumn = (columnId: string) => {
    if (selectedColumns.includes(columnId)) {
      onColumnChange(selectedColumns.filter(id => id !== columnId))
    } else {
      onColumnChange([...selectedColumns, columnId])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          Select columns
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search columns..." />
          <CommandEmpty>No column found.</CommandEmpty>
          <CommandGroup>
            {columns.map((column) => (
              <CommandItem
                key={column.id}
                onSelect={() => toggleColumn(column.id)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedColumns.includes(column.id) ? "opacity-100" : "opacity-0"
                  )}
                />
                {column.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
