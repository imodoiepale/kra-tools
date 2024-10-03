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
import { Settings, Plus } from 'lucide-react';

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
    const [activeSubCategory, setActiveSubCategory] = useState(categories[activeCategory][0]);
    const [items, setItems] = useState({});
    const [loading, setLoading] = useState(true);
    const [missingTables, setMissingTables] = useState([]);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [linkTableDialogOpen, setLinkTableDialogOpen] = useState(false);
    const [newCategory, setNewCategory] = useState({ name: '', subcategories: '' });
    const [selectedCategoryForLinking, setSelectedCategoryForLinking] = useState('');
    const [newItem, setNewItem] = useState({
        name: '',
        identifier: '',
        password: '',
        status: 'Pending'
    });

    useEffect(() => {
        initializeCategories();
        fetchAllDataForAllCategories();
    }, []);

    const initializeCategories = async () => {
        try {
            const missing = [];
            await Promise.all(
                Object.entries(categories).flatMap(([category, subcategories]) =>
                    subcategories.map(async subcategory => {
                        const tableName = `${category}_${subcategory}`.toLowerCase();
                        const { data, error } = await supabase
                            .from(tableName)
                            .select('id')
                            .limit(1);
                        
                        if (error) {
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
            const allData = {};
            await Promise.all(
                Object.entries(categories).flatMap(([category, subcategories]) =>
                    subcategories.map(async subcategory => {
                        const tableName = `${category}_${subcategory}`.toLowerCase();
                        const { data, error } = await supabase
                            .from(tableName)
                            .select('*')
                            .order('id', { ascending: true });

                        if (error) throw error;
                        allData[`${category}_${subcategory}`] = data || [];
                    })
                )
            );
            setItems(allData);
        } catch (error) {
            console.error('Error fetching all data:', error);
        } finally {
            setLoading(false);
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
        } catch (error) {
            console.error('Error adding category:', error);
        }
    };

    // const handleLinkTable = async (category, subcategory) => {
    //     try {
    //         const tableName = `${category}_${subcategory}`.toLowerCase();
    //         await supabase.rpc('create_table_if_not_exists', { table_name: tableName });

    //         setMissingTables(prev => prev.filter(item => item.category !== category || item.subcategory !== subcategory));
    //         setLinkTableDialogOpen(false);
    //     } catch (error) {
    //         console.error('Error linking table:', error);
    //     }
    // };

    const handleAddItem = async () => {
        try {
            const tableName = `${activeCategory}_${activeSubCategory}`.toLowerCase();
            const { data, error } = await supabase
                .from(tableName)
                .insert([newItem])
                .select();

            if (error) throw error;

            setItems(prev => ({
                ...prev,
                [`${activeCategory}_${activeSubCategory}`]: [
                    ...(prev[`${activeCategory}_${activeSubCategory}`] || []),
                    data[0]
                ]
            }));
            setAddDialogOpen(false);
            setNewItem({ name: '', identifier: '', password: '', status: 'Pending' });
        } catch (error) {
            console.error('Error adding item:', error);
        }
    };


    // Fetch all tables from the database
    const fetchTables = async () => {
        try {
            const { data, error } = await supabase.rpc('get_all_tables'); // Replace with the correct RPC or query to fetch all tables

            if (error) throw error;
            setTables(data || []);
            setFilteredTables(data || []);
        } catch (error) {
            console.error('Error fetching tables:', error);
        }
    };

    // Fetch columns from the selected table
    const fetchTableColumns = async (tableName) => {
        try {
            const { data, error } = await supabase.rpc('get_table_columns', { table_name: tableName }); // Replace with the correct RPC to get table columns

            if (error) throw error;
            setTableColumns(data || []);
        } catch (error) {
            console.error('Error fetching table columns:', error);
        }
    };

    useEffect(() => {
        if (linkTableDialogOpen) {
            fetchTables();
        }
    }, [linkTableDialogOpen]);

    // Handle table search
    const handleSearchChange = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        setFilteredTables(tables.filter(table => table.name.toLowerCase().includes(term.toLowerCase())));
    };

    // Handle table selection
    const handleTableSelect = (tableName) => {
        setSelectedTable(tableName);
        fetchTableColumns(tableName);
    };

    // Handle column mapping selection
    const handleColumnMappingChange = (categoryColumn, dbColumn) => {
        setColumnMappings(prev => ({
            ...prev,
            [categoryColumn]: dbColumn
        }));
    };

    const handleLinkTable = async () => {
        try {
            // Implement logic to save the column mappings and link the selected table to the category
            console.log('Selected Table:', selectedTable);
            console.log('Column Mappings:', columnMappings);

            // Close dialog after linking
            setLinkTableDialogOpen(false);
        } catch (error) {
            console.error('Error linking table:', error);
        }
    };


    return (
        <div className="p-4 w-full">
            {missingTables.length > 0 && (
                <div className="bg-yellow-400 text-white p-4 rounded mb-4">
                    <h2 className="font-bold text-lg">Missing Tables</h2>
                    <p className="text-sm">The following categories/subcategories do not have linked database tables:</p>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                        {missingTables.map(({ category, subcategory }) => (
                            <div key={`${category}_${subcategory}`} className="p-2 border border-white rounded text-sm">
                                {category} - {subcategory}
                            </div>
                        ))}
                    </div>
                    <Button className="text-sm" onClick={() => setLinkTableDialogOpen(true)}>
                        Link Existing or Create New
                    </Button>
                </div>
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Password Manager</CardTitle>
                        <CardDescription>Manage passwords for different categories</CardDescription>
                    </div>
                    <Button onClick={() => setSettingsDialogOpen(true)} variant="outline">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Button>
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
                                        <Button onClick={() => setAddDialogOpen(true)}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Item
                                        </Button>
                                    </CardHeader>

                                    <CardContent>
                                        {loading ? (
                                            <div>Loading...</div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>#</TableHead>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead>Identifier</TableHead>
                                                        <TableHead>Password</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead>Actions</TableHead>
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
            <AlertDialog open={linkTableDialogOpen} onOpenChange={setLinkTableDialogOpen}>
                <AlertDialogContent className="w-[500px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Link or Create Tables</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="space-y-4 grid grid-cols-2">
                        {missingTables.map(({ category, subcategory }) => (
                            <div key={`${category}_${subcategory}`}>
                                <p>{category} - {subcategory}</p>
                                <div className="space-x-2">
                                    <Button onClick={() => handleLinkTable(category, subcategory)}>Link with Existing</Button>
                                    <Button variant="outline" onClick={() => handleLinkTable(category, subcategory)}>Create New</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
