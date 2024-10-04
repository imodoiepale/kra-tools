// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Plus, Upload } from 'lucide-react';

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

export default function PasswordManager() {
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
    const fetchCategorySettings = async (category, subcategory) => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('column_settings, column_mappings, table_name')
                .eq('category', category)
                .eq('subcategory', subcategory)
                .single();

            if (error) throw error;

            if (data) {
                const { column_settings, column_mappings, table_name } = data;

                // Fetch all columns from the linked table
                const { data: tableColumns, error: tableError } = await supabase
                    .rpc('get_table_columns', { input_table_name: table_name });

                if (tableError) throw tableError;

                const allColumns = tableColumns.map(col => col.column_name);

                const defaultSettings = getDefaultColumnSettings(allColumns);
                const settings = column_settings || defaultSettings;

                // Ensure all columns from the table are present in the settings
                allColumns.forEach(column => {
                    if (!settings.visibleColumns.hasOwnProperty(column)) {
                        settings.visibleColumns[column] = true;
                    }
                    if (!settings.headerNames.hasOwnProperty(column)) {
                        settings.headerNames[column] = column;
                    }
                });

                setColumnSettings(prevSettings => ({
                    ...prevSettings,
                    [`${category}_${subcategory}`]: settings
                }));
            }
        } catch (error) {
            console.error('Error fetching category settings:', error);
            // Handle error (e.g., use default settings)
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
        const defaultColumns = ['name', 'identifier', 'password', 'status'];
        const defaultSettings = {
            visibleColumns: Object.fromEntries(defaultColumns.map(col => [col, true])),
            headerNames: Object.fromEntries(defaultColumns.map(col => [col, col.charAt(0).toUpperCase() + col.slice(1)]))
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

    const fetchColumnSettings = async (category, subcategory) => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('column_settings, column_mappings')
                .eq('category', category)
                .eq('subcategory', subcategory)
                .single();

            if (error) throw error;

            if (data && data.column_mappings) {
                const defaultSettings = {
                    visibleColumns: Object.fromEntries(
                        Object.keys(data.column_mappings).map(col => [col, true])
                    ),
                    headerNames: Object.fromEntries(
                        Object.keys(data.column_mappings).map(col => [col, col])
                    )
                };

                const mergedSettings = {
                    visibleColumns: { ...defaultSettings.visibleColumns, ...(data.column_settings?.visibleColumns || {}) },
                    headerNames: { ...defaultSettings.headerNames, ...(data.column_settings?.headerNames || {}) }
                };

                setColumnSettings(prevSettings => ({
                    ...prevSettings,
                    [`${category}_${subcategory}`]: mergedSettings
                }));

                // If there were no existing settings, save the default settings to the database
                if (!data.column_settings) {
                    await updateColumnSettings(category, subcategory, mergedSettings);
                }
            }
        } catch (error) {
            console.error('Error fetching column settings:', error);
        }
    };


    useEffect(() => {
        if (activeCategory && activeSubCategory) {
            fetchColumnSettings(activeCategory, activeSubCategory);
        }
    }, [activeCategory, activeSubCategory]);

    const updateColumnSettings = async (category, subcategory, newSettings) => {
        try {
            const { error } = await supabase
                .from('category_table_mappings')
                .update({ column_settings: newSettings })
                .eq('category', category)
                .eq('subcategory', subcategory);
    
            if (error) throw error;
    
            setColumnSettings(prevSettings => ({
                ...prevSettings,
                [`${category}_${subcategory}`]: newSettings
            }));
    
            console.log('Column settings updated successfully');
        } catch (error) {
            console.error('Error updating column settings:', error);
            throw error;
        }
    };

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
            {/* <div className="bg-blue-500 text-white p-4 rounded mb-4 shadow-md">
                <h2 className="font-bold text-xl">Missing Tables</h2>
                <p className="text-xs">The following categories/subcategories do not have linked database tables:</p>
                <div className="grid grid-cols-4 gap-4 mb-4">
                    {missingTables.map(({ category, subcategory }) => (
                        <div key={`${category}_${subcategory}`} className="p-2 border border-white rounded text-xs flex justify-between items-center">
                            <span>{category} - {subcategory}</span>
                            <div className="flex space-x-2">
                                <Button size="sm" onClick={() => {
                                    setSelectedCategoryForLinking({ category, subcategory });
                                    setLinkTableDialogOpen(true);
                                }} className="bg-green-500 hover:bg-green-700">Link</Button>
                                <Button size="sm" onClick={() => {
                                    setSelectedCategoryForLinking({ category, subcategory });
                                    setCreateTableDialogOpen(true);
                                }} className="bg-red-500 hover:bg-red-700">Create</Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div> */}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Password Manager</CardTitle>
                        <CardDescription>Manage passwords for different categories</CardDescription>
                    </div>
                    <div className="space-x-2">
                        <Button onClick={() => setCsvUploadDialogOpen(true)} variant="outline">
                            <Upload className="mr-2 h-4 w-4" />
                            Upload CSV
                        </Button>
                        <Button onClick={() => setSettingsDialogOpen(true)} variant="outline">
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center mb-1">
                        <Tabs value={activeCategory} onValueChange={setActiveCategory} defaultValue="companies">
                            <TabsList>
                                {Object.keys(categories).map(category => (
                                    <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                        <div className="flex justify-between items-center mb-1 gap-4">
                            <span className="text-sm text-gray-500">
                                Linked to: {linkedTables[`${activeCategory}_${activeSubCategory}`] || 'Not linked'}
                            </span>
                            <Button onClick={() => setAddDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Item
                            </Button>
                        </div>
                    </div>

                    {activeCategory && (
                        <Tabs value={activeSubCategory} onValueChange={setActiveSubCategory} className="mt-4">
                            <TabsList>
                                {categories[activeCategory]?.map(subcategory => (
                                    <TabsTrigger key={subcategory} value={subcategory}>
                                        {subcategory}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    )}

                    {activeCategory && activeSubCategory && (
                        <div className="mt-6">
                            
                            <div className="max-h-[620px] overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="sticky top-0 bg-gray-200 text-black">#</TableHead>
                                            {Object.entries(columnSettings[`${activeCategory}_${activeSubCategory}`]?.visibleColumns || {})
                                                .filter(([_, isVisible]) => isVisible)
                                                .map(([column, _]) => (
                                                    <TableHead key={column} className="sticky top-0 bg-gray-200 text-black">
                                                        {columnSettings[`${activeCategory}_${activeSubCategory}`]?.headerNames[column] || column}
                                                    </TableHead>
                                                ))}
                                            <TableHead className="sticky top-0 bg-gray-200 text-black">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items[`${activeCategory}_${activeSubCategory}`]?.map((item, index) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{index + 1}</TableCell>
                                                {Object.entries(columnSettings[`${activeCategory}_${activeSubCategory}`]?.visibleColumns || {})
                                                    .filter(([_, isVisible]) => isVisible)
                                                    .map(([column, _]) => (
                                                        <TableCell key={column}>{item[column]}</TableCell>
                                                    ))}
                                                <TableCell className="flex gap-4">
                                                    <Button onClick={() => { setItemToEdit(item); setEditDialogOpen(true); }}>Edit</Button>
                                                    <Button variant="destructive" onClick={() => { setItemToDelete(item); setDeleteDialogOpen(true); }}>Delete</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
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
                setColumnSettings={setColumnSettings}
                updateColumnSettings={updateColumnSettings}
                removeCategoryFromState={removeCategoryFromState}
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