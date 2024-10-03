// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from '@/lib/supabase';
import { Settings, Plus, Search, Upload } from 'lucide-react';

export default function PasswordManager() {
    const [categories, setCategories] = useState({
        KRA: ['Companies', 'Individuals'],
        ECITIZEN: ['Personal', 'Business'],
        NHIF: ['Employers', 'Employees'],
        NSSF: ['Employers', 'Employees'],
        IHC: ['Hospitals', 'Clinics'],
        QUICKBOOKS: ['Personal', 'Business']
    });
    const [activeCategory, setActiveCategory] = useState('KRA');
    const [activeSubCategory, setActiveSubCategory] = useState('Companies');
    const [items, setItems] = useState({});
    const [loading, setLoading] = useState(true);
    const [missingTables, setMissingTables] = useState([]);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [linkTableDialogOpen, setLinkTableDialogOpen] = useState(false);
    const [createTableDialogOpen, setCreateTableDialogOpen] = useState(false);
    const [newCategory, setNewCategory] = useState({ name: '', subcategories: '' });
    const [newItem, setNewItem] = useState({
        name: '',
        identifier: '',
        password: '',
        status: 'Pending'
    });
    const [dbTables, setDbTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [tableColumns, setTableColumns] = useState([]);
    const [columnMappings, setColumnMappings] = useState({});
    const [selectedCategoryForLinking, setSelectedCategoryForLinking] = useState(null);
    const [tableColumnsError, setTableColumnsError] = useState(null);
    const [linkedTables, setLinkedTables] = useState({});
    const [customTableName, setCustomTableName] = useState('');
    const [csvUploadDialogOpen, setCsvUploadDialogOpen] = useState(false);

    useEffect(() => {
        initializeCategories();
        fetchAllDataForAllCategories();
        fetchDbTables();
        fetchLinkedTables();
    }, []);

    const fetchLinkedTables = async () => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('category, subcategory, table_name');

            if (error) throw error;

            const tableMap = {};
            data.forEach(item => {
                tableMap[`${item.category}_${item.subcategory}`] = item.table_name;
            });

            setLinkedTables(tableMap);
        } catch (error) {
            console.error('Error fetching linked tables:', error);
        }
    };


    const initializeCategories = async () => {
        try {
            const { data: mappings, error: mappingsError } = await supabase
                .from('category_table_mappings')
                .select('*');

            if (mappingsError) throw mappingsError;

            const mappingsMap = new Map(mappings.map(m => [`${m.category}_${m.subcategory}`, m]));

            const missing = [];
            await Promise.all(
                Object.entries(categories).flatMap(([category, subcategories]) =>
                    subcategories.map(async subcategory => {
                        const key = `${category}_${subcategory}`;
                        if (!mappingsMap.has(key)) {
                            missing.push({ category, subcategory });
                        }
                    })
                )
            );
            setMissingTables(missing);
        } catch (error) {
            console.error('Error initializing categories:', error);
        }
    };

    const fetchAllDataForAllCategories = async () => {
        setLoading(true);
        try {
            const { data: mappings, error: mappingsError } = await supabase
                .from('category_table_mappings')
                .select('*');

            if (mappingsError) throw mappingsError;

            const allData = {};
            await Promise.all(
                mappings.map(async ({ category, subcategory, table_name, column_mappings }) => {
                    const { data, error } = await supabase
                        .from(table_name)
                        .select(Object.values(column_mappings).join(','))
                        .order('id', { ascending: true });

                    if (error) throw error;
                    allData[`${category}_${subcategory}`] = data.map(item => {
                        const mappedItem = {};
                        for (const [key, value] of Object.entries(column_mappings)) {
                            mappedItem[key] = item[value];
                        }
                        return mappedItem;
                    });
                })
            );
            setItems(allData);
        } catch (error) {
            console.error('Error fetching all data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDbTables = async () => {
        try {
            const { data, error } = await supabase.rpc('get_all_tables');
            if (error) throw error;
            setDbTables((data.map(item => item.table_name) || []).sort());
        } catch (error) {
            console.error('Error fetching database tables:', error);
        }
    };

    const handleAddCategory = async () => {
        if (!newCategory.name || !newCategory.subcategories) return;

        const categoryName = newCategory.name.toUpperCase();
        const subcategoriesList = newCategory.subcategories.split(',').map(s => s.trim());

        try {
            await Promise.all(
                subcategoriesList.map(subcategory => {
                    const tableName = `${categoryName}_${subcategory}`.toLowerCase();
                    return supabase.rpc('create_table_if_not_exists', { table_name: tableName });
                })
            );

            setCategories(prev => ({
                ...prev,
                [categoryName]: subcategoriesList
            }));

            setNewCategory({ name: '', subcategories: '' });
            setSettingsDialogOpen(false);
            initializeCategories();
            fetchDbTables();
        } catch (error) {
            console.error('Error adding category:', error);
        }
    };

    const handleAddItem = async () => {
        try {
            const { data: mapping, error: mappingError } = await supabase
                .from('category_table_mappings')
                .select('table_name, column_mappings')
                .eq('category', activeCategory)
                .eq('subcategory', activeSubCategory)
                .single();

            if (mappingError) throw mappingError;

            const { table_name, column_mappings } = mapping;

            const insertData = {};
            for (const [key, value] of Object.entries(column_mappings)) {
                insertData[value] = newItem[key];
            }

            const { data, error } = await supabase
                .from(table_name)
                .insert([insertData]);

            if (error) throw error;

            // Fetch the inserted item
            const { data: fetchedData, error: fetchError } = await supabase
                .from(table_name)
                .select('*')
                .order('id', { ascending: false })
                .limit(1)
                .single();

            if (fetchError) throw fetchError;

            setItems(prev => ({
                ...prev,
                [`${activeCategory}_${activeSubCategory}`]: [
                    ...(prev[`${activeCategory}_${activeSubCategory}`] || []),
                    fetchedData
                ]
            }));
            setAddDialogOpen(false);
            setNewItem({ name: '', identifier: '', password: '', status: 'Pending' });
        } catch (error) {
            console.error('Error adding item:', error);
            // Handle the error (e.g., show an error message to the user)
        }
    };

    const handleTableSelect = async (tableName) => {
        setSelectedTable(tableName);
        setTableColumnsError(null);
        try {
            const { data, error } = await supabase.rpc('get_table_columns', { input_table_name: tableName });
            if (error) throw error;
            console.log('Fetched table columns:', data);
            // Extract column names from the returned objects
            const columnNames = data.map(item => item.column_name);
            setTableColumns(columnNames || []);
        } catch (error) {
            console.error('Error fetching table columns:', error);
            setTableColumnsError(error.message);
        }
    };
    const handleColumnMappingChange = (categoryColumn, dbColumn) => {
        console.log('Mapping changed:', categoryColumn, dbColumn);
        setColumnMappings(prev => {
            const newMappings = {
                ...prev,
                [categoryColumn]: dbColumn
            };
            console.log('New column mappings:', newMappings);
            return newMappings;
        });
    };

    const handleLinkTable = async () => {
        if (!selectedCategoryForLinking || !selectedTable || Object.keys(columnMappings).length === 0) {
            console.error("Please select a category, table, and map columns");
            return;
        }

        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .upsert({
                    category: selectedCategoryForLinking.category,
                    subcategory: selectedCategoryForLinking.subcategory,
                    table_name: selectedTable,
                    column_mappings: columnMappings
                }, {
                    onConflict: 'category,subcategory'
                })
                .select();

            if (error) throw error;

            setMissingTables(prev => prev.filter(item =>
                item.category !== selectedCategoryForLinking.category ||
                item.subcategory !== selectedCategoryForLinking.subcategory
            ));

            setLinkTableDialogOpen(false);
            await fetchAllDataForAllCategories();
        } catch (error) {
            console.error('Error linking table:', error);
        }
    };

    const handleCreateNewTable = async () => {
        if (!selectedCategoryForLinking) {
            console.error("Please select a category");
            return;
        }

        try {
            const tableName = customTableName || `${selectedCategoryForLinking.category}_${selectedCategoryForLinking.subcategory}`.toLowerCase();
            await supabase.rpc('create_table_if_not_exists', { table_name: tableName });

            // Save the mapping
            await supabase.from('category_table_mappings').upsert({
                category: selectedCategoryForLinking.category,
                subcategory: selectedCategoryForLinking.subcategory,
                table_name: tableName,
                column_mappings: {
                    name: 'name',
                    identifier: 'identifier',
                    password: 'password',
                    status: 'status'
                }
            }, {
                onConflict: 'category,subcategory'
            });

            setMissingTables(prev => prev.filter(item =>
                item.category !== selectedCategoryForLinking.category ||
                item.subcategory !== selectedCategoryForLinking.subcategory
            ));

            setCreateTableDialogOpen(false);
            setCustomTableName('');
            await fetchAllDataForAllCategories();
            await fetchDbTables();
        } catch (error) {
            console.error('Error creating new table:', error);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const csv = e.target.result;
                const rows = csv.split('\n').map(row => row.split(','));
                const headers = rows[0];
                const data = rows.slice(1).map(row => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header.trim()] = row[index].trim();
                    });
                    return obj;
                });

                try {
                    const tableName = `${activeCategory}_${activeSubCategory}`.toLowerCase();
                    const { data: insertedData, error } = await supabase
                        .from(tableName)
                        .insert(data);

                    if (error) throw error;

                    await fetchAllDataForAllCategories();
                } catch (error) {
                    console.error('Error uploading CSV data:', error);
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="p-4 w-full">
            {missingTables.length > 0 && (
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
            )}

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
                                                            <TableHead className="sticky top-0 bg-white">Name</TableHead>
                                                            <TableHead className="sticky top-0 bg-white">Identifier</TableHead>
                                                            <TableHead className="sticky top-0 bg-white">Password</TableHead>
                                                            <TableHead className="sticky top-0 bg-white">Status</TableHead>
                                                            <TableHead className="sticky top-0 bg-white">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {items[`${category}_${activeSubCategory}`]?.map((item, index) => (
                                                            <TableRow key={item.id}>
                                                                <TableCell>{index + 1}</TableCell>
                                                                <TableCell>{item.name}</TableCell>
                                                                <TableCell>{item.identifier}</TableCell>
                                                                <TableCell>{item.password}</TableCell>
                                                                <TableCell>{item.status}</TableCell>
                                                                <TableCell>
                                                                    <Button>Edit</Button>
                                                                    <Button variant="destructive">Delete</Button>
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

            {/* Add Item Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Item</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Name</Label>
                            <Input
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Identifier</Label>
                            <Input
                                value={newItem.identifier}
                                onChange={(e) => setNewItem({ ...newItem, identifier: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Password</Label>
                            <Input
                                value={newItem.password}
                                onChange={(e) => setNewItem({ ...newItem, password: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddItem}>Save</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Settings Dialog */}
            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Category Name</Label>
                            <Input
                                value={newCategory.name}
                                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Subcategories (comma-separated)</Label>
                            <Input
                                value={newCategory.subcategories}
                                onChange={(e) => setNewCategory({ ...newCategory, subcategories: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddCategory}>Add</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Link Table Dialog */}
            <Dialog open={linkTableDialogOpen} onOpenChange={setLinkTableDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Link Existing Table</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Select value={selectedTable} onValueChange={handleTableSelect}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a table" />
                            </SelectTrigger>
                            <SelectContent>
                                {dbTables.map(table => (
                                    <SelectItem key={table} value={table}>{table}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {tableColumnsError && (
                            <div className="text-red-500">Error: {tableColumnsError}</div>
                        )}
                        {selectedTable && !tableColumnsError && (
                            <div>
                                <h3 className="font-bold mb-2">Map Columns</h3>
                                <div className="grid grid-cols-2 gap-4 capitalize">
                                    {['name', 'identifier', 'password', 'status'].map(col => (
                                        <div key={col} className="flex flex-col space-y-2">
                                            <Label>{col}</Label>
                                            <Select
                                                value={columnMappings[col] || ''}
                                                onValueChange={(value) => handleColumnMappingChange(col, value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select column" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {tableColumns.map(dbCol => (
                                                        <SelectItem key={dbCol} value={dbCol}>{dbCol}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end space-x-2 mt-4">
                        <Button variant="outline" onClick={() => setLinkTableDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleLinkTable}>Link Table</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Table Dialog */}
            <Dialog open={createTableDialogOpen} onOpenChange={setCreateTableDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Table</DialogTitle>
                    </DialogHeader>
                    <p>Creating a new table for {selectedCategoryForLinking?.category} - {selectedCategoryForLinking?.subcategory}</p>
                    <div className="space-y-4">
                        <div>
                            <Label>Custom Table Name (optional)</Label>
                            <Input
                                value={customTableName}
                                onChange={(e) => setCustomTableName(e.target.value)}
                                placeholder={`${selectedCategoryForLinking?.category}_${selectedCategoryForLinking?.subcategory}`.toLowerCase()}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-4">
                        <Button variant="outline" onClick={() => setCreateTableDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateNewTable}>Create Table</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* CSV Upload Dialog */}
            <Dialog open={csvUploadDialogOpen} onOpenChange={setCsvUploadDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload CSV</DialogTitle>
                    </DialogHeader>
                    <p>Upload a CSV file to import data for {activeCategory} - {activeSubCategory}</p>
                    <Input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                    />
                    <div className="flex justify-end space-x-2 mt-4">
                        <Button variant="outline" onClick={() => setCsvUploadDialogOpen(false)}>Cancel</Button>
                        <Button onClick={() => document.querySelector('input[type="file"]').click()}>Select File</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}