"use client";
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface ClientCategoryFilterProps {
  onClearFilters: () => void;
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: any) => void;
  selectedFilters: any;
  counts?: {
    [category: string]: {
      [status: string]: number;
    }
  }
}

const categories = [
  { id: 'all', label: 'All Categories' },
  { id: 'acc', label: 'Accounting' },
  { id: 'imm', label: 'Immigration' },
  { id: 'sheria', label: 'Sheria' },
  { id: 'audit', label: 'Audit' },
];

const statuses = ['all', 'active', 'inactive'];

export function ClientCategoryFilter({
  isOpen,
  onClose,
  onApplyFilters,
  onClearFilters,
  selectedFilters,
  counts = {}
}: ClientCategoryFilterProps) {
  const [localFilters, setLocalFilters] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    const initialFilters: Record<string, Record<string, boolean>> = {};

    // Initialize with empty objects for each category
    categories.forEach(category => {
      initialFilters[category.id] = {};
      statuses.forEach(status => {
        // If we have selected filters, use them; otherwise default to false
        initialFilters[category.id][status] =
          selectedFilters[category.id]?.[status] || false;
      });
    });

    // If no filters are set at all, set a default (ACC/all)
    if (Object.keys(selectedFilters).length === 0) {
      initialFilters['acc']['all'] = true;
    }

    setLocalFilters(initialFilters);
  }, [selectedFilters, isOpen]);

  const handleCheckboxChange = (category: string, status: string) => {
    setLocalFilters(prev => {
      const newFilters = { ...prev };

      if (!newFilters[category]) {
        newFilters[category] = {};
      }

      newFilters[category][status] = !newFilters[category][status];

      return newFilters;
    });
  };

  const handleApply = () => {
    // Remove any categories with no selected statuses
    const cleanedFilters = Object.entries(localFilters).reduce((acc, [category, statuses]) => {
      const hasSelectedStatus = Object.values(statuses).some(isSelected => isSelected);
      if (hasSelectedStatus) {
        acc[category] = statuses;
      }
      return acc;
    }, {} as Record<string, Record<string, boolean>>);

    onApplyFilters(cleanedFilters);
    onClose();
  };

  const handleClearAll = () => {
    const emptyFilters: Record<string, Record<string, boolean>> = {};
    categories.forEach(category => {
      emptyFilters[category.id] = {};
      statuses.forEach(status => {
        emptyFilters[category.id][status] = false;
      });
    });

    setLocalFilters(emptyFilters);
    onClearFilters();
  };

  // Calculate if any filters are applied
  const hasActiveFilters = Object.values(localFilters).some(categoryStatuses =>
    Object.values(categoryStatuses).some(isSelected => isSelected)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Client Category Filter</DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden border rounded-md">
          <table className="w-full border-collapse">
            <thead className="bg-blue-100">
              <tr>
                <th className="border px-4 py-2 text-left">Category</th>
                {statuses.map(status => (
                  <th key={status} className="border px-4 py-2 text-center">
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((category, idx) => (
                <tr key={category.id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="border px-4 py-2">{category.label}</td>
                  {statuses.map(status => {
                    const count = counts[category.id]?.[status] || 0;
                    const checkboxId = `${category.id}-${status}`;

                    return (
                      <td key={status} className="border px-4 py-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={checkboxId}
                              checked={localFilters[category.id]?.[status] || false}
                              onCheckedChange={() => handleCheckboxChange(category.id, status)}
                              className="cursor-pointer"
                            />
                            {/* Use a button instead of a label for better clickability */}
                            <button
                              type="button"
                              onClick={() => handleCheckboxChange(category.id, status)}
                              className="text-sm cursor-pointer bg-transparent border-0 p-0 hover:underline focus:outline-none"
                            >
                              Select
                            </button>
                          </div>
                          <Badge variant={count > 0 ? "default" : "outline"}>
                            {count}
                          </Badge>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <div className="space-x-2">
            <Button
              variant="outline"
              onClick={handleClearAll}
              disabled={!hasActiveFilters}
            >
              Clear All
            </Button>
            <Button
              onClick={handleApply}
              disabled={!hasActiveFilters}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}