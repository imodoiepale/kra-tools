// @ts-nocheck
import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FileDown } from "lucide-react";
import ExcelJS from 'exceljs';
import { CategoryFilters, type CategoryFilter } from './CategoryFilters';

interface TableToolbarProps {
    globalFilter: string;
    setGlobalFilter: (value: string) => void;
    showTotals: boolean;
    setShowTotals: (value: boolean) => void;
    onExport: () => void;
    categoryFilters: CategoryFilter[];
    onFilterChange: (key: string) => void;
    companies: any[];
    activeTab: string;
}

export function TableToolbar({
    globalFilter,
    setGlobalFilter,
    showTotals,
    setShowTotals,
    onExport,
    categoryFilters,
    onFilterChange,
    companies,
    activeTab
}: TableToolbarProps) {
    const exportToExcel = async () => {
        if (!Array.isArray(companies) || companies.length === 0) {
            console.error('No data to export');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(activeTab || 'Companies');

        // Define columns based on the active tab
        const columns = [
            { header: '#', key: 'index', width: 5 },
            { header: 'Company Name', key: 'company_name', width: 30 },
            { header: 'KRA PIN', key: 'kra_pin', width: 15 },
            // Add more columns based on your needs
        ];

        worksheet.columns = columns;

        // Add data
        companies.forEach((company, index) => {
            worksheet.addRow({
                index: index + 1,
                company_name: company.company_name,
                kra_pin: company.kra_pin,
                // Add more fields based on your needs
            });
        });

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Generate and download the file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${activeTab || 'companies'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex justify-between items-center my-4">
            <div className="flex items-center space-x-4">
                <Input
                    placeholder="Search..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="w-64"
                />
            </div>
            <div className="flex items-center space-x-4">
                <CategoryFilters 
                    categoryFilters={categoryFilters}
                    onFilterChange={onFilterChange}
                />
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Show Totals</span>
                    <Switch
                        checked={showTotals}
                        onCheckedChange={setShowTotals}
                        className="data-[state=checked]:bg-green-500"
                    />
                </div>
                <Button onClick={exportToExcel} size="sm">
                    <FileDown className="mr-2 h-4 w-4" />
                    Export
                </Button>
            </div>
        </div>
    );
}
