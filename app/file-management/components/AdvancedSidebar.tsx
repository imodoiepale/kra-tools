// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
    Filter,
    Search,
    Building2,
    Calendar,
    Tag,
    X,
    ChevronLeft,
    ChevronRight,
    Users,
    Star,
    AlertCircle,
    CheckCircle,
    Clock
} from "lucide-react";
import { Company, FilterState } from '../types/fileManagement';
import { cn } from '@/lib/utils';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';

interface AdvancedSidebarProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    companies: Company[];
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

export default function AdvancedSidebar({
    filters,
    onFiltersChange,
    companies,
    isCollapsed,
    onToggleCollapse
}: AdvancedSidebarProps) {
    const [localFilters, setLocalFilters] = useState(filters);

    // Extract unique values from companies and filter out empty values
    const categories = [...new Set(companies.map(c => c.category))].filter(Boolean);
    const industries = [...new Set(companies.map(c => c.industry))].filter(Boolean);
    const statuses = [...new Set(companies.map(c => c.status))].filter(Boolean);
    const priorities = [...new Set(companies.map(c => c.priority))].filter(Boolean);

    // Calculate active filter count
    const activeFilterCount = Object.values(filters).flat().filter(Boolean).length;

    const applyFilters = () => {
        onFiltersChange(localFilters);
    };

    const clearAllFilters = () => {
        const emptyFilters: FilterState = {
            search: '',
            categories: [],
            industries: [],
            status: [],
            dateRange: { start: null, end: null },
            priority: [],
            processingStatus: []
        };
        setLocalFilters(emptyFilters);
        onFiltersChange(emptyFilters);
    };

    const updateFilter = (key: keyof FilterState, value: any) => {
        setLocalFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const toggleArrayFilter = (key: keyof FilterState, value: string) => {
        const currentArray = localFilters[key] as string[];
        const newArray = currentArray.includes(value)
            ? currentArray.filter(item => item !== value)
            : [...currentArray, value];

        updateFilter(key, newArray);
    };

    // Collapsed sidebar view
    if (isCollapsed) {
        return (
            <div className="w-16 border-r bg-card shadow-sm">
                <div className="p-4 space-y-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleCollapse}
                        className="w-full h-12 flex flex-col items-center justify-center hover:bg-blue-50"
                    >
                        <Filter className="h-4 w-4 text-blue-600" />
                        {activeFilterCount > 0 && (
                            <Badge
                                variant="destructive"
                                className="mt-1 text-xs h-5 w-5 rounded-full p-0 flex items-center justify-center"
                            >
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>

                    {/* Quick filter icons */}
                    <div className="space-y-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-10 flex items-center justify-center"
                            title="Companies"
                        >
                            <Building2 className="h-4 w-4 text-gray-600" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-10 flex items-center justify-center"
                            title="Categories"
                        >
                            <Tag className="h-4 w-4 text-gray-600" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-10 flex items-center justify-center"
                            title="Status"
                        >
                            <CheckCircle className="h-4 w-4 text-gray-600" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Expanded sidebar view
    return (
        <div className="w-80 border-r bg-card h-full overflow-hidden flex flex-col shadow-sm">
            {/* Header */}
            <div className="p-4 border-b bg-blue-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-full">
                            <Filter className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-blue-800">Advanced Filters</h2>
                            <p className="text-xs text-blue-600">
                                {companies.length} companies • {activeFilterCount} filters active
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleCollapse}
                        className="hover:bg-blue-100"
                    >
                        <ChevronLeft className="h-4 w-4 text-blue-600" />
                    </Button>
                </div>

                {activeFilterCount > 0 && (
                    <div className="mt-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={clearAllFilters}
                            className="w-full border-red-200 text-red-600 hover:bg-red-50"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Clear All Filters
                        </Button>
                    </div>
                )}
            </div>

            {/* Scrollable Filters */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Search */}
                <Card className="border-blue-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center text-blue-800">
                            <Search className="h-4 w-4 mr-2" />
                            Search Companies
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input
                            placeholder="Search by name or KRA PIN..."
                            value={localFilters.search}
                            onChange={(e) => updateFilter('search', e.target.value)}
                            className="border-blue-200 focus:border-blue-400"
                        />
                    </CardContent>
                </Card>

                {/* Categories */}
                <Card className="border-blue-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between text-blue-800">
                            <div className="flex items-center">
                                <Building2 className="h-4 w-4 mr-2" />
                                Company Categories
                            </div>
                            {localFilters.categories.length > 0 && (
                                <Badge className="bg-blue-100 text-blue-800">
                                    {localFilters.categories.length}
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {categories.map(category => {
                            const count = companies.filter(c => c.category === category).length;
                            const isSelected = localFilters.categories.includes(category);

                            return (
                                <div key={category} className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={category}
                                            checked={isSelected}
                                            onCheckedChange={() => toggleArrayFilter('categories', category)}
                                            className="border-blue-300"
                                        />
                                        <Label
                                            htmlFor={category}
                                            className={cn(
                                                "text-sm capitalize cursor-pointer",
                                                isSelected ? "text-blue-700 font-medium" : "text-gray-700"
                                            )}
                                        >
                                            {category}
                                        </Label>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        {count}
                                    </Badge>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* Industries */}
                <Card className="border-blue-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center text-blue-800">
                            <Tag className="h-4 w-4 mr-2" />
                            Industries
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Select
                            value={localFilters.industries[0] || ''}
                            onValueChange={(value) => updateFilter('industries', value ? [value] : [])}
                        >
                            <SelectTrigger className="border-blue-200">
                                <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all_industries">All Industries</SelectItem>
                                {industries.map(industry => (
                                    <SelectItem key={industry} value={industry || 'unknown'}>
                                        {industry || 'Unknown'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {/* Status */}
                <Card className="border-blue-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between text-blue-800">
                            <div className="flex items-center">
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Company Status
                            </div>
                            {localFilters.status.length > 0 && (
                                <Badge className="bg-blue-100 text-blue-800">
                                    {localFilters.status.length}
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {statuses.map(status => {
                            const count = companies.filter(c => c.status === status).length;
                            const isSelected = localFilters.status.includes(status);
                            const statusConfig = {
                                active: { icon: <CheckCircle className="h-3 w-3 text-green-500" />, color: 'text-green-700' },
                                inactive: { icon: <Clock className="h-3 w-3 text-yellow-500" />, color: 'text-yellow-700' },
                                suspended: { icon: <AlertCircle className="h-3 w-3 text-red-500" />, color: 'text-red-700' }
                            }[status] || { icon: null, color: 'text-gray-700' };

                            return (
                                <div key={status} className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={status}
                                            checked={isSelected}
                                            onCheckedChange={() => toggleArrayFilter('status', status)}
                                            className="border-blue-300"
                                        />
                                        <Label
                                            htmlFor={status}
                                            className={cn(
                                                "text-sm capitalize cursor-pointer flex items-center space-x-2",
                                                isSelected ? "text-blue-700 font-medium" : statusConfig.color
                                            )}
                                        >
                                            {statusConfig.icon}
                                            <span>{status}</span>
                                        </Label>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        {count}
                                    </Badge>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* Priority */}
                <Card className="border-blue-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between text-blue-800">
                            <div className="flex items-center">
                                <Star className="h-4 w-4 mr-2" />
                                Priority Level
                            </div>
                            {localFilters.priority.length > 0 && (
                                <Badge className="bg-blue-100 text-blue-800">
                                    {localFilters.priority.length}
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {priorities.map(priority => {
                            const count = companies.filter(c => c.priority === priority).length;
                            const isSelected = localFilters.priority.includes(priority);
                            const priorityConfig = {
                                high: { color: 'text-red-600', badge: 'bg-red-100 text-red-800' },
                                medium: { color: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-800' },
                                low: { color: 'text-green-600', badge: 'bg-green-100 text-green-800' }
                            }[priority] || { color: 'text-gray-600', badge: 'bg-gray-100 text-gray-800' };

                            return (
                                <div key={priority} className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={priority}
                                            checked={isSelected}
                                            onCheckedChange={() => toggleArrayFilter('priority', priority)}
                                            className="border-blue-300"
                                        />
                                        <Label
                                            htmlFor={priority}
                                            className={cn(
                                                "text-sm capitalize cursor-pointer",
                                                isSelected ? "text-blue-700 font-medium" : priorityConfig.color
                                            )}
                                        >
                                            {priority}
                                        </Label>
                                    </div>
                                    <Badge className={cn("text-xs", priorityConfig.badge)}>
                                        {count}
                                    </Badge>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* Date Range */}
                <Card className="border-blue-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center text-blue-800">
                            <Calendar className="h-4 w-4 mr-2" />
                            Date Range
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DatePickerWithRange
                            dateRange={localFilters.dateRange}
                            onDateRangeChange={(range) => updateFilter('dateRange', range)}
                            className="w-full"
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Apply Filters Button */}
            <div className="p-4 border-t bg-blue-50">
                <Button
                    onClick={applyFilters}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={JSON.stringify(filters) === JSON.stringify(localFilters)}
                >
                    Apply Filters
                </Button>
            </div>
        </div>
    );
}