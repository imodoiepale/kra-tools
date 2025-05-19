// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Plus, Upload, ArrowUpDown, Search, Download } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { handleFileUpload, downloadTemplate } from './utils/csvUtils';
import Start from './Start';
import PasswordCheckerRunning from './PasswordCheckerRunning';
import PasswordCheckerReports from './PasswordCheckerReports';

export default function CheckerManager() {
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [linkTableDialogOpen, setLinkTableDialogOpen] = useState(false);
    const [createTableDialogOpen, setCreateTableDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [csvUploadDialogOpen, setCsvUploadDialogOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [selectedCategoryForLinking, setSelectedCategoryForLinking] = useState(null);
    const [dbColumns, setDbColumns] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [searchTerm, setSearchTerm] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [activeTab, setActiveTab] = useState("PasswordCheckerReports");
    const [status, setStatus] = useState("Not Started");
    const [companies, setCompanies] = useState([]);


    // Function to handle sorting
    const handleSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // Function to handle searching
    const handleSearch = (event) => {
        setSearchTerm(event.target.value);
    };

    const getSortedAndFilteredItems = () => {
        let currentItems = items[`${activeCategory}_${activeSubCategory}`] || [];

        // Apply search filter
        if (searchTerm) {
            currentItems = currentItems.filter(item =>
                Object.values(item).some(value =>
                    String(value).toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        }

        // Apply sorting
        if (sortConfig.key) {
            currentItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }

        return currentItems;
    };

    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium">Password Check Reports</h3>
                        <CardDescription>Manage passwords for different categories</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="Reports" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="Start">Start</TabsTrigger>
                            <TabsTrigger value="Running">Running</TabsTrigger>
                            <TabsTrigger value="Reports">Reports</TabsTrigger>
                        </TabsList>
                        <TabsContent value="Start">
                            <Start />
                        </TabsContent>
                        <TabsContent value="Running">
                            <PasswordCheckerRunning />
                        </TabsContent>
                        <TabsContent value="Reports">
                            <PasswordCheckerReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}