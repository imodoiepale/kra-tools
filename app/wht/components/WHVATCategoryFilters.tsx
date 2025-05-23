// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface CategoryFiltersProps {
  setSelectedCategories?: (categories: string[]) => void;
  className?: string;
}

export function WHVATCategoryFilters({ setSelectedCategories, className }: CategoryFiltersProps) {
  const [open, setOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [categoryStatuses, setCategoryStatuses] = useState<Record<string, string>>({
    accounting: 'all',
    audit: 'all',
    tax: 'all',
    sheria: 'all',
    immigration: 'all'
  });

  const categories = [
    { value: 'accounting', label: 'Accounting' },
    { value: 'audit', label: 'Audit' },
    { value: 'tax', label: 'Tax' },
    { value: 'sheria', label: 'Sheria' },
    { value: 'immigration', label: 'Immigration' }
  ];

  const statuses = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active Only' },
    { value: 'inactive', label: 'Inactive Only' }
  ];

  // Safely call the setSelectedCategories function
  const updateSelectedCategories = (newCategories: string[]) => {
    setSelectedValues(newCategories);
    if (setSelectedCategories) {
      setSelectedCategories(newCategories);
    }
  };

  // Update selected values when category statuses change
  useEffect(() => {
    const newSelectedValues: string[] = [];

    // Process selected categories with their status
    Object.entries(categoryStatuses).forEach(([category, status]) => {
      if (status !== 'all') {
        newSelectedValues.push(`${category}_status_${status}`);
      } else if (selectedValues.includes(category)) {
        newSelectedValues.push(category);
      }
    });

    // Add any plain categories that are selected
    categories.forEach(cat => {
      if (selectedValues.includes(cat.value) && !newSelectedValues.some(v => v.startsWith(cat.value))) {
        newSelectedValues.push(cat.value);
      }
    });

    updateSelectedCategories(newSelectedValues);
  }, [categoryStatuses]);

  const handleCategorySelect = (category: string, checked: boolean) => {
    setSelectedValues(prev => {
      if (checked) {
        return [...prev, category];
      } else {
        return prev.filter(item => item !== category && !item.startsWith(`${category}_status_`));
      }
    });

    if (!checked) {
      // Reset status if category is unchecked
      setCategoryStatuses(prev => ({
        ...prev,
        [category]: 'all'
      }));
    }
  };

  const handleStatusSelect = (category: string, status: string) => {
    setCategoryStatuses(prev => ({
      ...prev,
      [category]: status
    }));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn("justify-between w-full", className)}>
          <span className="truncate">
            {selectedValues.length > 0
              ? `${selectedValues.length} category filters selected`
              : "Select categories"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No categories found.</CommandEmpty>
            <CommandGroup heading="Service Categories">
              {categories.map((category) => {
                const isSelected = selectedValues.includes(category.value) ||
                  selectedValues.some(v => v.startsWith(`${category.value}_status_`));
                const status = categoryStatuses[category.value];

                return (
                  <div key={category.value} className="flex flex-col">
                    <CommandItem
                      value={category.value}
                      className="flex items-center"
                      onSelect={() => { }}
                    >
                      <div className="flex items-center space-x-2 flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategorySelect(category.value, !isSelected);
                        }}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => { }}
                          className="mr-2"
                        />
                        <span>{category.label}</span>
                      </div>

                      {isSelected && (
                        <div className="flex items-center ml-auto gap-1">
                          {status !== 'all' && (
                            <Badge variant={status === 'active' ? 'success' : 'destructive'} className="ml-auto">
                              {status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CommandItem>

                    {isSelected && (
                      <div className="ml-8 mb-2">
                        {statuses.map((statusOption) => (
                          <div key={statusOption.value} className="flex items-center space-x-2 py-1">
                            <Checkbox
                              checked={status === statusOption.value}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  handleStatusSelect(category.value, statusOption.value);
                                }
                              }}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-sm">{statusOption.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <Separator className="my-1" />
                  </div>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            <div className="p-2 flex flex-wrap gap-1">
              {Object.entries(categoryStatuses).map(([category, status]) => {
                if (selectedValues.includes(category) || status !== 'all') {
                  const categoryObj = categories.find(c => c.value === category);
                  return (
                    <Badge key={category} variant="outline" className="flex items-center gap-1">
                      {categoryObj?.label}
                      {status !== 'all' && `(${status})`}
                      <button
                        className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onClick={() => {
                          handleCategorySelect(category, false);
                        }}
                      >
                        <span className="sr-only">Remove</span>
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </Badge>
                  );
                }
                return null;
              })}
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// X icon component for badges
function X(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}