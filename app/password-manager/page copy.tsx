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
        columns.forEach(column => {
            visibleColumns[column] = true;
            headerNames[column] = column;
        });
        return { visibleColumns, headerNames };
    };

    // Function to update column settings in the database
    const updateColumnSettings = async (category, subcategory, newSettings) => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .update({
                    column_settings: newSettings
                })
                .eq('category', category)
                .eq('subcategory', subcategory);

            if (error) throw error;

            console.log('Column settings updated successfully');

            // Update local state
            setColumnSettings(prevSettings => ({
                ...prevSettings,
                [`${category}_${subcategory}`]: newSettings
            }));

        } catch (error) {
            console.error('Error updating column settings:', error);
            // Handle error (e.g., show an error message to the user)
        }
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
    

    return (
        <div className="p-4 w-full">
            {/* {missingTables.length > 0 && ( */}
            <div className="bg-blue-500 text-white p-4 rounded mb-4 shadow-md">
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
            </div>
            {/* )} */}

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
                    <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                        <TabsList>
                            {Object.keys(categories).map(category => (
                                <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
                            ))}
                        </TabsList>

                        {Object.entries(categories).map(([category, subcategories]) => (
                            <TabsContent key={category} value={category}>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle>{category}</CardTitle>
                                            <Select value={activeSubCategory} onValueChange={setActiveSubCategory}>
                                                <SelectTrigger className="w-[200px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {subcategories.map(sub => (
                                                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-sm text-gray-500">
                                                Linked to: {linkedTables[`${category}_${activeSubCategory}`] || 'Not linked'}
                                            </span>
                                            <Button onClick={() => setAddDialogOpen(true)}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Item
                                            </Button>
                                        </div>
                                    </CardHeader>

                                    <CardContent>
                                        {loading ? (
                                            <div>Loading...</div>
                                        ) : (
                                            <div className="max-h-[400px] overflow-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="sticky top-0 bg-white">#</TableHead>
                                                            {Object.keys(getCurrentColumnSettings().visibleColumns).map(column => {
                                                                const settings = getCurrentColumnSettings();
                                                                if (settings.visibleColumns[column]) {
                                                                    return (
                                                                        <TableHead key={column} className="sticky top-0 bg-white">
                                                                            {settings.headerNames[column] || column}
                                                                        </TableHead>
                                                                    );
                                                                }
                                                                return null;
                                                            })}
                                                            <TableHead className="sticky top-0 bg-white">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {items[`${activeCategory}_${activeSubCategory}`]?.map((item, index) => (
                                                            <TableRow key={item.id}>
                                                                <TableCell>{index + 1}</TableCell>
                                                                {Object.keys(getCurrentColumnSettings().visibleColumns).map(column => {
                                                                    const settings = getCurrentColumnSettings();
                                                                    if (settings.visibleColumns[column]) {
                                                                        return <TableCell key={column}>{item[column]}</TableCell>;
                                                                    }
                                                                    return null;
                                                                })}
                                                                <TableCell className="flex gap-4">
                                                                    <Button onClick={() => { setItemToEdit(item); setEditDialogOpen(true); }}>Edit</Button>
                                                                    <Button variant="destructive" onClick={() => { setItemToDelete(item); setDeleteDialogOpen(true); }}>Delete</Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        ))}
                    </Tabs>
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
                onAddColumn={handleAddColumn}
                categories={categories}
                missingTables={missingTables}
                dbTables={dbTables}
                onAddCategory={handleAddCategory}
                onLinkTable={handleLinkTable}
                onCreateTable={handleCreateNewTable}
                onUpdateColumnVisibility={handleUpdateColumnVisibility}
                onUpdateHeaderNames={handleUpdateHeaderNames}
                currentSettings={getCurrentColumnSettings()}
                setColumnSettings={setColumnSettings}
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
                refreshData={fetchAllDataForAllCategories} // Add this line
            />
        </div>
    );
}