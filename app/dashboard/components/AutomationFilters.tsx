// app/dashboard/components/AutomationFilters.tsx

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AutomationStatus } from "../types";
import { useState } from "react";

interface AutomationFiltersProps {
    onFilterByStatus: (status: AutomationStatus | 'all') => void;
    onClearFilters: () => void;
}

export function AutomationFilters({
    onFilterByStatus,
    onClearFilters
}: AutomationFiltersProps) {
    const [activeStatus, setActiveStatus] = useState<AutomationStatus | 'all'>('all');
    const [activeSchedule, setActiveSchedule] = useState('all');

    const handleStatusChange = (status: AutomationStatus | 'all') => {
        setActiveStatus(status);
        onFilterByStatus(status);
    };

    return (
        <div className="bg-gray-50 p-4 rounded-lg border mt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h3 className="text-sm font-medium text-gray-700">Filters</h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        onClearFilters();
                        setActiveStatus('all');
                        setActiveSchedule('all');
                    }}
                    className="text-sm mt-2 sm:mt-0"
                >
                    Clear all
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="search-automation">Search</Label>
                    <Input
                        id="search-automation"
                        placeholder="Search automations"
                        className="w-full"
                    />
                </div>

                <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex flex-wrap gap-2">
                        <Button 
                            variant={activeStatus === 'all' ? "default" : "outline"} 
                            size="sm"
                            onClick={() => handleStatusChange('all')}
                        >
                            All
                        </Button>
                        <Button 
                            variant={activeStatus === 'success' ? "default" : "outline"} 
                            size="sm"
                            onClick={() => handleStatusChange('success')}
                            className={activeStatus === 'success' ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                        >
                            Success
                        </Button>
                        <Button 
                            variant={activeStatus === 'failed' ? "default" : "outline"} 
                            size="sm"
                            onClick={() => handleStatusChange('failed')}
                            className={activeStatus === 'failed' ? "bg-red-600 hover:bg-red-700" : ""}
                        >
                            Failed
                        </Button>
                        <Button 
                            variant={activeStatus === 'in-progress' ? "default" : "outline"} 
                            size="sm"
                            onClick={() => handleStatusChange('in-progress')}
                            className={activeStatus === 'in-progress' ? "bg-blue-600 hover:bg-blue-700" : ""}
                        >
                            In Progress
                        </Button>
                        <Button 
                            variant={activeStatus === 'pending' ? "default" : "outline"} 
                            size="sm"
                            onClick={() => handleStatusChange('pending')}
                            className={activeStatus === 'pending' ? "bg-amber-600 hover:bg-amber-700" : ""}
                        >
                            Pending
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Schedule</Label>
                    <div className="flex flex-wrap gap-2">
                        <Button 
                            variant={activeSchedule === 'all' ? "default" : "outline"} 
                            size="sm"
                            onClick={() => setActiveSchedule('all')}
                        >
                            All
                        </Button>
                        <Button 
                            variant={activeSchedule === 'daily' ? "default" : "outline"} 
                            size="sm"
                            onClick={() => setActiveSchedule('daily')}
                        >
                            Daily
                        </Button>
                        <Button 
                            variant={activeSchedule === 'weekly' ? "default" : "outline"} 
                            size="sm"
                            onClick={() => setActiveSchedule('weekly')}
                        >
                            Weekly
                        </Button>
                        <Button 
                            variant={activeSchedule === 'monthly' ? "default" : "outline"} 
                            size="sm"
                            onClick={() => setActiveSchedule('monthly')}
                        >
                            Monthly
                        </Button>
                        <Button 
                            variant={activeSchedule === 'on-demand' ? "default" : "outline"} 
                            size="sm"
                            onClick={() => setActiveSchedule('on-demand')}
                        >
                            On Demand
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}