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

import { useCategories, useItems, useTables } from './hooks/hooks';
import { handleFileUpload, downloadTemplate } from './utils/csvUtils';
import {
    AddItemDialog,
    SettingsDialog,
    LinkTableDialog,
    CreateTableDialog,
    EditItemDialog,
    DeleteItemDialog,
    CsvUploadDialog
} from './components/Dialogs';
import Start from './Start';
import PasswordCheckerRunning from './PasswordCheckerRunning';
import PasswordCheckerReports from './PasswordCheckerReports';

export default function Categories() {
    const { categories, activeCategory, setActiveCategory, activeSubCategory, setActiveSubCategory, handleAddCategory } = useCategories();
    const { items, loading, handleAddItem, handleEditItem, handleDeleteItem, fetchAllDataForAllCategories } = useItems(activeCategory, activeSubCategory);
    const { dbTables, linkedTables, missingTables, handleLinkTable, handleCreateNewTable } = useTables(categories);

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
    const [columnSettings, setColumnSettings] = useState({});

    const [dbColumns, setDbColumns] = useState([]);
    const [localColumnSettings, setLocalColumnSettings] = useState({
        visibleColumns: {},
        headerNames: {},
        columnOrder: []
    });
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

    // Function to handle exporting
    const handleExport = () => {
        const currentItems = items[`${activeCategory}_${activeSubCategory}`] || [];
        const csvContent = [
            Object.keys(currentItems[0] || {}).join(','),
            ...currentItems.map(item => Object.values(item).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${activeCategory}_${activeSubCategory}_export.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };



    // Function to update column order
    const updateColumnOrder = (newOrder) => {
        const currentSettings = columnSettings[`${activeCategory}_${activeSubCategory}`];
        const newSettings = {
            ...currentSettings,
            columnOrder: newOrder
        };
        setColumnSettings(prevSettings => ({
            ...prevSettings,
            [`${activeCategory}_${activeSubCategory}`]: newSettings
        }));
    };


    const getDefaultColumnSettings = (columns) => {
        const visibleColumns = {};
        const headerNames = {};
        const columnOrder = [];
        columns.forEach((column, index) => {
            visibleColumns[column] = true;
            headerNames[column] = column;
            columnOrder.push(column);
        });
        return { visibleColumns, headerNames, columnOrder };
    };


    // Function to handle updating column visibility
    const handleUpdateColumnVisibility = async (category, subcategory, visibleColumns) => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('column_settings, column_mappings')
                .eq('category', category)
                .eq('subcategory', subcategory)
                .single();

            if (error) throw error;

            const currentSettings = data.column_settings || getDefaultColumnSettings(Object.keys(data.column_mappings));
            const newSettings = {
                ...currentSettings,
                visibleColumns: {
                    ...currentSettings.visibleColumns,
                    ...visibleColumns
                }
            };

            await updateColumnSettings(category, subcategory, newSettings);

        } catch (error) {
            console.error('Error updating column visibility:', error);
            // Handle error (e.g., show an error message to the user)
        }
    };

    // Function to handle updating header names
    const handleUpdateHeaderNames = async (category, subcategory, headerNames) => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('column_settings, column_mappings')
                .eq('category', category)
                .eq('subcategory', subcategory)
                .single();

            if (error) throw error;

            const currentSettings = data.column_settings || getDefaultColumnSettings(Object.keys(data.column_mappings));
            const newSettings = {
                ...currentSettings,
                headerNames: {
                    ...currentSettings.headerNames,
                    ...headerNames
                }
            };

            await updateColumnSettings(category, subcategory, newSettings);

        } catch (error) {
            console.error('Error updating header names:', error);
            // Handle error (e.g., show an error message to the user)
        }
    };

    // Function to fetch category settings
    const fetchCategorySettings = async () => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('column_settings, table_name')
                .eq('category', selectedCategory)
                .eq('subcategory', selectedSubcategory)
                .single();

            if (error) throw error;

            // Provide default values if data is undefined
            const currentSettings = data?.column_settings || {};
            const defaultColumns = ['index', 'company_name', 'identifier', 'password', 'status'];

            const mergedSettings = {
                visibleColumns: { index: true, ...currentSettings.visibleColumns },
                headerNames: { index: 'Index', ...currentSettings.headerNames },
                columnOrder: ['index', ...(currentSettings.columnOrder || defaultColumns.slice(1))]
            };

            // Ensure all columns have a visibility and header name setting
            mergedSettings.columnOrder.forEach(column => {
                if (!mergedSettings.visibleColumns.hasOwnProperty(column)) {
                    mergedSettings.visibleColumns[column] = true;
                }
                if (!mergedSettings.headerNames.hasOwnProperty(column)) {
                    mergedSettings.headerNames[column] = column.charAt(0).toUpperCase() + column.slice(1);
                }
            });

            setLocalColumnSettings(mergedSettings);
            setSelectedTable(data?.table_name || '');

            // Fetch all columns for the table
            if (data?.table_name) {
                const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', {
                    input_table_name: data.table_name
                });

                if (columnsError) throw columnsError;

                setDbColumns(columns.map(col => col.column_name));
            }
        } catch (error) {
            console.error('Error fetching category settings:', error);
            // Set default values in case of error
            setLocalColumnSettings({
                visibleColumns: {},
                headerNames: {},
                columnOrder: []
            });
            setDbColumns([]);
        }
    };

    // Use effect to fetch settings when category or subcategory changes
    useEffect(() => {
        if (activeCategory && activeSubCategory) {
            fetchCategorySettings(activeCategory, activeSubCategory);
        }
    }, [activeCategory, activeSubCategory]);

    // Function to get current settings for the active category and subcategory
    const getCurrentColumnSettings = () => {
        const defaultColumns = ['company_name', 'identifier', 'password', 'status'];
        const defaultSettings = {
            visibleColumns: Object.fromEntries(Object.keys(column_mappings).map(key => [key, true])),
            headerNames: { ...column_mappings },
            columnOrder: ['index', 'company_name', ...Object.keys(column_mappings).filter(key => key !== 'company_name')]
        };

        const currentSettings = columnSettings[`${activeCategory}_${activeSubCategory}`];

        if (!currentSettings || !currentSettings.visibleColumns || !currentSettings.headerNames) {
            return defaultSettings;
        }

        // Ensure all default columns are present in the settings
        const updatedSettings = {
            visibleColumns: { ...defaultSettings.visibleColumns, ...currentSettings.visibleColumns },
            headerNames: { ...defaultSettings.headerNames, ...currentSettings.headerNames }
        };

        return updatedSettings;
    };

    const handleAddColumn = async (category, subcategory, columnName) => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('column_mappings, table_name')
                .eq('category', category)
                .eq('subcategory', subcategory)
                .single();

            if (error) throw error;

            const { column_mappings, table_name } = data;

            // Add the new column to the actual database table
            const { error: alterTableError } = await supabase.rpc('add_column_to_table', {
                p_table_name: table_name,
                p_column_name: columnName.toLowerCase(),
                p_data_type: 'text'
            });

            if (alterTableError) throw alterTableError;

            // Add the new column to the column_mappings
            const updatedColumnMappings = {
                ...column_mappings,
                [columnName]: columnName.toLowerCase()
            };

            // Update the category_table_mappings with the new column_mappings
            const { error: updateError } = await supabase
                .from('category_table_mappings')
                .update({ column_mappings: updatedColumnMappings })
                .eq('category', category)
                .eq('subcategory', subcategory);

            if (updateError) throw updateError;

            // Update local state
            setColumnSettings(prevSettings => {
                const currentSettings = prevSettings[`${category}_${subcategory}`] || {};
                return {
                    ...prevSettings,
                    [`${category}_${subcategory}`]: {
                        ...currentSettings,
                        visibleColumns: {
                            ...currentSettings.visibleColumns,
                            [columnName]: true
                        },
                        headerNames: {
                            ...currentSettings.headerNames,
                            [columnName]: columnName
                        }
                    }
                };
            });

            // Refresh data
            await fetchAllDataForAllCategories();
        } catch (error) {
            console.error('Error adding new column:', error);
        }
    };

    useEffect(() => {
        if (activeCategory && activeSubCategory) {
            fetchColumnSettings();
        }
    }, [activeCategory, activeSubCategory]);

    const fetchColumnSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('column_settings, table_name')
                .eq('category', activeCategory)
                .eq('subcategory', activeSubCategory)
                .single();

            if (error) throw error;

            console.log('Fetched data:', data); // Log the fetched data for debugging

            const currentSettings = data?.column_settings || {};
            console.log('Current settings:', currentSettings); // Log the current settings

            const defaultColumns = ['index', 'company_name', 'identifier', 'password', 'status'];

            const mergedSettings = {
                visibleColumns: { index: true, ...currentSettings.visibleColumns },
                headerNames: { index: 'Index', ...currentSettings.headerNames },
                columnOrder: ['index', ...(currentSettings.columnOrder || defaultColumns.slice(1))]
            };

            console.log('Merged settings:', mergedSettings); // Log the merged settings

            setLocalColumnSettings(mergedSettings);
            setColumnSettings(prevSettings => ({
                ...prevSettings,
                [`${activeCategory}_${activeSubCategory}`]: mergedSettings
            }));

            // Fetch all columns for the table
            if (data?.table_name) {
                const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', {
                    input_table_name: data.table_name
                });

                if (columnsError) throw columnsError;

                setDbColumns(columns.map(col => col.column_name));
            }
        } catch (error) {
            console.error('Error fetching category settings:', error);
            setLocalColumnSettings({
                visibleColumns: {},
                headerNames: {},
                columnOrder: []
            });
            setDbColumns([]);
        }
    };

    const getCurrentColumnOrder = () => {
        const currentSettings = columnSettings[`${activeCategory}_${activeSubCategory}`];
        if (currentSettings && currentSettings.columnOrder) {
            return currentSettings.columnOrder;
        }
        // Fallback to default order if no custom order is set
        return ['index', 'company_name', 'identifier', 'password', 'status'];
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

    const updateColumnSettings = (category, subcategory, newSettings) => {
        setColumnSettings(prevSettings => ({
            ...prevSettings,
            [`${category}_${subcategory}`]: newSettings
        }));
    };


    useEffect(() => {
        if (activeCategory && activeSubCategory) {
            fetchColumnSettings(activeCategory, activeSubCategory);
        }
    }, [activeCategory, activeSubCategory]);



    const removeCategoryFromState = (category, subcategory) => {
        setCategories(prevCategories => {
            const newCategories = { ...prevCategories };
            if (newCategories[category]) {
                newCategories[category] = newCategories[category].filter(sub => sub !== subcategory);
                if (newCategories[category].length === 0) {
                    delete newCategories[category];
                }
            }
            return newCategories;
        });

        setColumnSettings(prevSettings => {
            const newSettings = { ...prevSettings };
            delete newSettings[`${category}_${subcategory}`];
            return newSettings;
        });
    };




    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium">Password Check Reports</h3>
                        <CardDescription>Manage passwords for different categories</CardDescription>
                    </div>
                    <div className="space-x-2">
                        <Button onClick={() => setCsvUploadDialogOpen(true)} variant="outline">
                            <Upload className="mr-2 h-4 w-4" />
                            Upload CSV
                        </Button>
                        <Button onClick={handleExport} variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button onClick={() => setSettingsDialogOpen(true)} variant="outline">
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                        <div className="flex justify-end items-center mb-3 gap-4">
                            <span className="text-sm text-gray-500">
                                Linked to: {linkedTables[`${activeCategory}_${activeSubCategory}`] || 'Not linked'}
                            </span>
                            <Button onClick={() => setAddDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Item
                            </Button>
                        </div>
            
                </CardContent>
            </Card>

            <AddItemDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onAddItem={handleAddItem}
            />

            <SettingsDialog
                open={settingsDialogOpen}
                onOpenChange={setSettingsDialogOpen}
                categories={categories}
                missingTables={missingTables}
                dbTables={dbTables}
                onAddCategory={handleAddCategory}
                onLinkTable={handleLinkTable}
                onCreateTable={handleCreateNewTable}
                columnSettings={columnSettings}
                updateColumnSettings={updateColumnSettings}
                activeCategory={activeCategory}
                activeSubCategory={activeSubCategory}
            />

            <LinkTableDialog
                open={linkTableDialogOpen}
                onOpenChange={setLinkTableDialogOpen}
                dbTables={dbTables}
                onLinkTable={(selectedTable, columnMappings) =>
                    handleLinkTable(selectedTable, columnMappings, selectedCategoryForLinking.category, selectedCategoryForLinking.subcategory)
                }
            />

            <CreateTableDialog
                open={createTableDialogOpen}
                onOpenChange={setCreateTableDialogOpen}
                onCreateTable={(customTableName) =>
                    handleCreateNewTable(customTableName, selectedCategoryForLinking.category, selectedCategoryForLinking.subcategory)
                }
                selectedCategoryForLinking={selectedCategoryForLinking}
            />

            <EditItemDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                itemToEdit={itemToEdit}
                onEditItem={handleEditItem}
            />

            <DeleteItemDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                itemToDelete={itemToDelete}
                onDeleteItem={handleDeleteItem}
            />

            <CsvUploadDialog
                open={csvUploadDialogOpen}
                onOpenChange={setCsvUploadDialogOpen}
                activeCategory={activeCategory}
                activeSubCategory={activeSubCategory}
                onFileUpload={handleFileUpload}
                onDownloadTemplate={downloadTemplate}
                refreshData={fetchAllDataForAllCategories}
            />
        </div>
    );
}