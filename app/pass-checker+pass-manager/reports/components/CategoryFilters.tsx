import React from 'react'
import { Button } from "@/components/ui/button"
import { Filter } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"

export interface CategoryFilter {
  label: string
  key: string
  checked: boolean
}

interface CategoryFiltersProps {
  categoryFilters: CategoryFilter[]
  onFilterChange: (key: string) => void
}

export function CategoryFilters({ categoryFilters, onFilterChange }: CategoryFiltersProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter Categories
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-2">
        {categoryFilters.map((filter) => (
          <div key={filter.key} className="flex items-center space-x-2 p-2">
            <Checkbox
              id={filter.key}
              checked={filter.checked}
              onCheckedChange={() => onFilterChange(filter.key)}
            />
            <label
              htmlFor={filter.key}
              className="text-sm font-medium leading-none"
            >
              {filter.label}
            </label>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
