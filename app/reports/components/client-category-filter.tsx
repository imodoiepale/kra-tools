"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Client Category Filter</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

          <div className="grid">
            <div className="border rounded-lg">
              <div className="grid grid-cols-4 gap-0">
                <div className="p-2 font-semibold bg-blue-500 text-white">Client Category</div>
                <div className="col-span-3 grid grid-cols-3 gap-0">
                  {statuses.map((status) => (
                    <div key={status} className="p-2 font-semibold bg-blue-500 text-white text-center">
                      {status}
                    </div>
                  ))}
                </div>
              </div>
              {categories.map((category) => (
                <div key={category.id} className="grid grid-cols-4 gap-0 border-t">
                  <div className="p-2">{category.label}</div>
                  {statuses.map((status) => (
                    <div key={status} className="flex items-center justify-center p-2">
                      <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-blue-600"
                        checked={localFilters[category.id]?.[status.toLowerCase()] || false}
                        onChange={() => handleCheckboxChange(category.id, status)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setLocalFilters({})}>Clear All</Button>
              <Button onClick={handleApply}>Apply Filters</Button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
}
