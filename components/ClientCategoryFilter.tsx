"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface ClientCategoryFilterProps {
  onClearFilters: () => void;
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: any) => void;
  selectedFilters: any;
}

const categories = [
  { id: 'all', label: 'All Categories' },
  { id: 'acc', label: 'Acc' },
  { id: 'imm', label: 'Imm' },
  { id: 'sheria', label: 'Sheria' },
  { id: 'audit', label: 'Audit' },
];

const statuses = ['All', 'Active', 'Inactive'];

export function ClientCategoryFilter({ isOpen, onClose, onApplyFilters, onClearFilters, selectedFilters }: ClientCategoryFilterProps) {
  const [localFilters, setLocalFilters] = React.useState(selectedFilters);

  React.useEffect(() => {
    setLocalFilters(selectedFilters);
  }, [selectedFilters]);

  const handleCheckboxChange = (category: string, status: string) => {
    setLocalFilters((prev: any) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [status.toLowerCase()]: !prev[category]?.[status.toLowerCase()]
      }
    }));
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleClearAll = () => {
    setLocalFilters({});
    onClearFilters();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Client Category Filter</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="border rounded-md overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-4">
            <div className="p-2 font-semibold bg-blue-500 text-white">Client Category</div>
            <div className="col-span-3 grid grid-cols-3">
              {statuses.map((status) => (
                <div key={status} className="p-2 font-semibold bg-blue-500 text-white text-center">
                  {status}
                </div>
              ))}
            </div>
          </div>
          
          {/* Category Rows */}
          {categories.map((category) => (
            <div key={category.id} className="grid grid-cols-4 border-t border-gray-200">
              <div className="p-2">{category.label}</div>
              {statuses.map((status) => (
                <div key={status} className="flex items-center justify-center p-2">
                  <Checkbox 
                    id={`${category.id}-${status.toLowerCase()}`}
                    checked={localFilters[category.id]?.[status.toLowerCase()] || false}
                    onCheckedChange={() => handleCheckboxChange(category.id, status)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <div className="space-x-2">
            <Button variant="outline" onClick={handleClearAll}>Clear All</Button>
            <Button onClick={handleApply}>Apply Filters</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
