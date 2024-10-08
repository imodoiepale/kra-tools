// @ts-nocheck
"use client"

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Download } from "lucide-react";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { toast } from 'react-hot-toast';

export default function ExportDialog({ filteredClients, checklist, selectedDate }) {
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        dataType: 'all',
        sheetType: 'single',
        includeReminders: false
    });

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();

        const getData = () => {
            if (exportOptions.dataType === 'all') return filteredClients;
            return filteredClients.filter(client => {
                const year = selectedDate.getFullYear();
                const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
                return !checklist[client.company_name]?.[year]?.[month]?.receivedAt;
            });
        };

        const data = getData();

        if (exportOptions.sheetType === 'single') {
            const sheet = workbook.addWorksheet('Clients');
            sheet.addRow(['Company Name', 'KRA PIN', 'Files Received', 'Files Delivered', 'Reminders Sent']);
            data.forEach(client => {
                const year = selectedDate.getFullYear();
                const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
                const clientData = checklist[client.company_name]?.[year]?.[month];
                sheet.addRow([
                    client.company_name,
                    client.kra_pin,
                    clientData?.receivedAt ? 'Yes' : 'No',
                    clientData?.filesDelivered ? 'Yes' : 'No',
                    exportOptions.includeReminders ? (clientData?.remindersSent || 0) : 'N/A'
                ]);
            });
        } else {
            data.forEach(client => {
                const sheet = workbook.addWorksheet(client.company_name);
                sheet.addRow(['Month', 'Files Received', 'Files Delivered', 'Reminders Sent']);
                const year = selectedDate.getFullYear();
                for (let month = 1; month <= 12; month++) {
                    const monthKey = month.toString().padStart(2, '0');
                    const clientData = checklist[client.company_name]?.[year]?.[monthKey];
                    sheet.addRow([
                        monthKey,
                        clientData?.receivedAt ? 'Yes' : 'No',
                        clientData?.filesDelivered ? 'Yes' : 'No',
                        exportOptions.includeReminders ? (clientData?.remindersSent || 0) : 'N/A'
                    ]);
                }
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), 'client_data.xlsx');
        setExportDialogOpen(false);
        toast.success('Excel file exported successfully');
    };

    return (
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
                <Button size="sm" onClick={() => setExportDialogOpen(true)}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Export Options</DialogTitle>
                </DialogHeader>
                {/* ... (rest of the dialog content) */}
                <DialogFooter>
                    <Button onClick={exportToExcel}>Export</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}