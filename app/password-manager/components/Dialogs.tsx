// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from '@/lib/supabase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


export function AddItemDialog({ open, onOpenChange, onAddItem }) {
    const [newItem, setNewItem] = useState({ name: '', identifier: '', password: '', status: 'Pending' });

    const handleSave = () => {
        onAddItem(newItem);
        onOpenChange(false);
        setNewItem({ name: '', identifier: '', password: '', status: 'Pending' });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                <div className="flex justify-end space-x-2 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}



export function SettingsDialog({
    open,
    onOpenChange,
    categories,
    missingTables,
    dbTables,
    onAddCategory,
    onLinkTable,
    onCreateTable,
    columnSettings,
    updateColumnSettings,
    activeCategory,
    activeSubCategory,
    removeCategoryFromState
}) {
    const [activeTab, setActiveTab] = useState("categories");
    const [newCategory, setNewCategory] = useState({ name: '', subcategories: '' });
    const [selectedCategory, setSelectedCategory] = useState(activeCategory);
    const [selectedSubcategory, setSelectedSubcategory] = useState(activeSubCategory);
    const [selectedTable, setSelectedTable] = useState('');
    const [columnMappings, setColumnMappings] = useState({});
    const [dbColumns, setDbColumns] = useState([]);
    const [newColumnName, setNewColumnName] = useState('');
    const [localColumnSettings, setLocalColumnSettings] = useState({
        visibleColumns: {},
        headerNames: {},
        columnOrder: []
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [categoryToDelete, setCategoryToDelete] = useState('');
    const [subcategoryToDelete, setSubcategoryToDelete] = useState('');


    useEffect(() => {
        if (selectedCategory && selectedSubcategory) {
            fetchColumnMappings();
            fetchAllTableColumns();
        }
    }, [selectedCategory, selectedSubcategory]);

    useEffect(() => {
        if (selectedTable) {
            fetchTableColumns();
        }
    }, [selectedTable]);

    const fetchColumnMappings = async () => {
        const { data, error } = await supabase
            .from('category_table_mappings')
            .select('column_mappings, table_name, column_settings')
            .eq('category', selectedCategory)
            .eq('subcategory', selectedSubcategory)
            .single();

        if (error) {
            console.error('Error fetching column mappings:', error);
            return;
        }

        setColumnMappings(data.column_mappings || {});
        setSelectedTable(data.table_name || '');

        const currentSettings = data.column_settings || {};
        const defaultColumns = ['index', 'name', 'identifier', 'password', 'status'];

        const mergedSettings = {
            visibleColumns: { index: true, ...currentSettings.visibleColumns },
            headerNames: { index: 'Index', ...currentSettings.headerNames },
            columnOrder: ['index', ...(currentSettings.columnOrder || defaultColumns.slice(1))]
        };

        setLocalColumnSettings(mergedSettings);
    };

    const fetchTableColumns = async () => {
        const { data, error } = await supabase.rpc('get_table_columns', { input_table_name: selectedTable });
        if (error) {
            console.error('Error fetching table columns:', error);
            return;
        }
        setDbColumns(data.map(col => col.column_name));
    };

    const fetchAllTableColumns = async () => {
        if (!selectedTable) return;

        const { data, error } = await supabase.rpc('get_table_columns', { input_table_name: selectedTable });
        if (error) {
            console.error('Error fetching table columns:', error);
            return;
        }
        setDbColumns(data.map(col => col.column_name));
    };

    const handleAddCategory = () => {
        onAddCategory(newCategory);
        setNewCategory({ name: '', subcategories: '' });
    };

    const handleLinkTable = () => {
        onLinkTable(selectedTable, columnMappings, selectedCategory, selectedSubcategory);
    };

    const handleCreateTable = () => {
        onCreateTable(null, selectedCategory, selectedSubcategory);
    };

    const handleColumnMappingChange = (categoryColumn, dbColumn) => {
        setColumnMappings(prev => {
            const newMappings = { ...prev };
            if (dbColumn === null) {
                delete newMappings[categoryColumn];
            } else {
                Object.keys(newMappings).forEach(key => {
                    if (newMappings[key] === dbColumn) {
                        delete newMappings[key];
                    }
                });
                newMappings[categoryColumn] = dbColumn;
            }
            return newMappings;
        });
    };

    const handleAddColumn = () => {
        if (!newColumnName) return;

        setLocalColumnSettings(prev => ({
            ...prev,
            visibleColumns: {
                ...prev.visibleColumns,
                [newColumnName]: true
            },
            headerNames: {
                ...prev.headerNames,
                [newColumnName]: newColumnName
            },
            columnOrder: [...prev.columnOrder, newColumnName]
        }));

        setNewColumnName('');
    };

    const handleDeleteCategory = async () => {
        if (!categoryToDelete || !subcategoryToDelete) return;

        try {
            const tableName = `${categoryToDelete}_${subcategoryToDelete}`.toLowerCase();

            const { error: dropTableError } = await supabase.rpc('drop_table_if_exists', {
                table_name: tableName
            });

            if (dropTableError) throw dropTableError;

            const { error: deleteMappingError } = await supabase
                .from('category_table_mappings')
                .delete()
                .eq('category', categoryToDelete)
                .eq('subcategory', subcategoryToDelete);

            if (deleteMappingError) throw deleteMappingError;

            removeCategoryFromState(categoryToDelete, subcategoryToDelete);

            setCategoryToDelete('');
            setSubcategoryToDelete('');
            alert('Category and associated table deleted successfully.');
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Error deleting category. Please try again.');
        }
    };

    const handleDeleteAllTableContents = async () => {
        if (!selectedCategory || !selectedSubcategory) return;

        try {
            const { data: tableData, error: tableError } = await supabase
                .from('category_table_mappings')
                .select('table_name')
                .eq('category', selectedCategory)
                .eq('subcategory', selectedSubcategory)
                .single();

            if (tableError) throw tableError;

            const { error: deleteError } = await supabase
                .from(tableData.table_name)
                .delete()
                .neq('id', 0); // This will delete all rows

            if (deleteError) throw deleteError;

            alert('All table contents deleted successfully');
        } catch (error) {
            console.error('Error deleting table contents:', error);
            alert('Error deleting table contents. Please try again.');
        }
    };

    const handleVisibilityChange = (column, isVisible) => {
        setLocalColumnSettings(prev => ({
            ...prev,
            visibleColumns: {
                ...prev.visibleColumns,
                [column]: isVisible
            },
            columnOrder: isVisible
                ? [...new Set([...prev.columnOrder, column])]
                : prev.columnOrder.filter(col => col !== column)
        }));
    };

    const handleHeaderNameChange = (column, newName) => {
        setLocalColumnSettings(prev => ({
            ...prev,
            headerNames: {
                ...prev.headerNames,
                [column]: newName
            }
        }));
    };

    const handleOrderChange = (column, newOrder) => {
        setLocalColumnSettings(prev => {
            const newColumnOrder = prev.columnOrder.filter(col => col !== column);
            newColumnOrder.splice(newOrder - 1, 0, column);
            return { ...prev, columnOrder: newColumnOrder };
        });
    };

    const fetchColumnSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('column_settings, table_name')
                .eq('category', selectedCategory)
                .eq('subcategory', selectedSubcategory)
                .single();

            if (error) throw error;

            console.log('Fetched data:', data); // Log the fetched data for debugging

            const currentSettings = data?.column_settings || {};
            console.log('Current settings:', currentSettings); // Log the current settings

            const defaultColumns = ['index', 'name', 'identifier', 'password', 'status'];

            const mergedSettings = {
                visibleColumns: { index: true, ...currentSettings.visibleColumns },
                headerNames: { index: 'Index', ...currentSettings.headerNames },
                columnOrder: ['index', ...(currentSettings.columnOrder || defaultColumns.slice(1))]
            };

            console.log('Merged settings:', mergedSettings); // Log the merged settings

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
            setLocalColumnSettings({
                visibleColumns: {},
                headerNames: {},
                columnOrder: []
            });
            setDbColumns([]);
        }
    };

    useEffect(() => {
        if (selectedCategory && selectedSubcategory) {
            fetchColumnSettings();
        }
    }, [selectedCategory, selectedSubcategory]);

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const updatedSettings = {
                visibleColumns: localColumnSettings.visibleColumns,
                headerNames: localColumnSettings.headerNames,
                columnOrder: localColumnSettings.columnOrder
            };

            const { error } = await supabase
                .from('category_table_mappings')
                .update({ column_settings: updatedSettings })
                .eq('category', selectedCategory)
                .eq('subcategory', selectedSubcategory);

            if (error) throw error;

            // Call the updateColumnSettings callback
            updateColumnSettings(selectedCategory, selectedSubcategory, updatedSettings);

            alert('Changes saved successfully');
        } catch (error) {
            console.error('Error saving changes:', error);
            setSaveError('Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="flex space-x-4 mb-4">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.keys(categories).map(category => (
                                <SelectItem key={category} value={category}>{category}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories[selectedCategory]?.map(subcategory => (
                                <SelectItem key={subcategory} value={subcategory}>{subcategory}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="categories">Categories</TabsTrigger>
                        <TabsTrigger value="tables">Tables</TabsTrigger>
                        <TabsTrigger value="columns">Columns</TabsTrigger>
                        <TabsTrigger value="delete">Delete</TabsTrigger>
                    </TabsList>
                    <TabsContent value="categories">
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
                            <Button onClick={handleAddCategory}>Add Category + Table</Button>
                        </div>
                    </TabsContent>
                    <TabsContent value="tables">
                        <div className="space-y-4">
                            <h3 className="font-bold">Missing Tables</h3>
                            {missingTables.length > 0 ? (
                                <div className="grid grid-cols-2 gap-4">
                                    {missingTables.map(({ category, subcategory }) => (
                                        <div key={`${category}_${subcategory}`} className="p-2 border rounded flex justify-between items-center">
                                            <span>{category} - {subcategory}</span>
                                            <div className="space-x-2">
                                                <Button size="sm" onClick={() => {
                                                    setSelectedCategory(category);
                                                    setSelectedSubcategory(subcategory);
                                                    setActiveTab("columns");
                                                }}>Link</Button>
                                                <Button size="sm" onClick={() => handleCreateTable(category, subcategory)}>Create</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p>No missing tables found.</p>
                            )}
                        </div>
                    </TabsContent>
                    <TabsContent value="columns">
                        <div className="space-y-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order</TableHead>
                                        <TableHead>Visible</TableHead>
                                        <TableHead>Column Name</TableHead>
                                        <TableHead>Display Name</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dbColumns.map((column, index) => {
                                        const isVisible = localColumnSettings.visibleColumns[column] !== false;
                                        const order = localColumnSettings.columnOrder.indexOf(column) + 1;
                                        return (
                                            <TableRow key={column} className={isVisible ? '' : 'opacity-50'}>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        max={dbColumns.length}
                                                        value={order || ''}
                                                        onChange={(e) => handleOrderChange(column, parseInt(e.target.value, 10))}
                                                        className="w-16"
                                                        disabled={!isVisible}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={isVisible}
                                                        onCheckedChange={(checked) => handleVisibilityChange(column, checked)}
                                                        disabled={column === 'index'}
                                                    />
                                                </TableCell>
                                                <TableCell>{column}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={localColumnSettings.headerNames[column] || column}
                                                        onChange={(e) => handleHeaderNameChange(column, e.target.value)}
                                                        placeholder="Display Name"
                                                        disabled={!isVisible}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            <div className="flex items-center space-x-2">
                                <Input
                                    placeholder="New column name"
                                    value={newColumnName}
                                    onChange={(e) => setNewColumnName(e.target.value)}
                                />
                                <Button onClick={handleAddColumn}>Add Column</Button>
                            </div>
                            <Button onClick={handleSaveChanges} disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                            {saveError && <p className="text-red-500">{saveError}</p>}
                        </div>
                    </TabsContent>
                    <TabsContent value="delete">
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-bold">Delete Category and Table</h3>
                                <div className="flex space-x-2 mt-2">
                                    <Select value={categoryToDelete} onValueChange={setCategoryToDelete}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.keys(categories).map(category => (
                                                <SelectItem key={category} value={category}>{category}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={subcategoryToDelete} onValueChange={setSubcategoryToDelete}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select subcategory" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories[categoryToDelete]?.map(subcategory => (
                                                <SelectItem key={subcategory} value={subcategory}>{subcategory}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={handleDeleteCategory} variant="destructive">Delete Category</Button>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold mt-4">Delete All Table Contents</h3>
                                <div className="flex space-x-2 mt-2">
                                    <Button onClick={handleDeleteAllTableContents} variant="destructive">Delete All Contents</Button>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">This will delete all contents of the currently selected table ({selectedCategory} - {selectedSubcategory})</p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

export function LinkTableDialog({ open, onOpenChange, dbTables, onLinkTable }) {
    const [selectedTable, setSelectedTable] = useState('');
    const [tableColumns, setTableColumns] = useState([]);
    const [columnMappings, setColumnMappings] = useState({});

    const handleTableSelect = async (tableName) => {
        setSelectedTable(tableName);
        const { data, error } = await supabase.rpc('get_table_columns', { input_table_name: tableName });
        if (error) {
            console.error('Error fetching table columns:', error);
            return;
        }
        setTableColumns(data.map(col => col.column_name));
    };

    const handleColumnMappingChange = (categoryColumn, dbColumn) => {
        setColumnMappings(prev => ({
            ...prev,
            [categoryColumn]: dbColumn
        }));
    };

    const handleSave = () => {
        onLinkTable(selectedTable, columnMappings);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                    {selectedTable && (
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
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Link Table</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function CreateTableDialog({ open, onOpenChange, onCreateTable, selectedCategoryForLinking }) {
    const [customTableName, setCustomTableName] = useState('');

    const handleSave = () => {
        onCreateTable(customTableName);
        onOpenChange(false);
        setCustomTableName('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Create Table</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function EditItemDialog({ open, onOpenChange, itemToEdit, onEditItem }) {
    const [editedItem, setEditedItem] = useState(itemToEdit || {});

    React.useEffect(() => {
        setEditedItem(itemToEdit || {});
    }, [itemToEdit]);

    const handleSave = () => {
        onEditItem(editedItem);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    {Object.entries(editedItem).map(([key, value]) => (
                        key !== 'id' && (
                            <div key={key}>
                                <Label>{key}</Label>
                                <Input
                                    value={value || ''}
                                    onChange={(e) => setEditedItem({ ...editedItem, [key]: e.target.value })}
                                />
                            </div>
                        )
                    ))}
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function DeleteItemDialog({ open, onOpenChange, itemToDelete, onDeleteItem }) {
    const handleDelete = () => {
        onDeleteItem(itemToDelete);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Item</DialogTitle>
                </DialogHeader>
                <p>Are you sure you want to delete {itemToDelete?.name}?</p>
                <div className="flex justify-end space-x-2 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleDelete}>Delete</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function CsvUploadDialog({
    open,
    onOpenChange,
    activeCategory,
    activeSubCategory,
    onFileUpload,
    onDownloadTemplate,
    refreshData
}) {
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setIsUploading(true);
            setError(null);
            setSuccess(false);
            try {
                await onFileUpload(file, activeCategory, activeSubCategory);
                setSuccess(true);
                await refreshData();
            } catch (err) {
                setError(err.message || 'An error occurred during upload');
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload CSV for {activeCategory} - {activeSubCategory}</DialogTitle>
                </DialogHeader>
                <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={isUploading}
                />
                <Button onClick={() => onDownloadTemplate(activeCategory, activeSubCategory)} disabled={isUploading}>
                    Download Template
                </Button>
                {isUploading && <p>Uploading... Please wait.</p>}
                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {success && (
                    <Alert variant="success">
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>CSV data uploaded successfully</AlertDescription>
                    </Alert>
                )}
                <div className="flex justify-end space-x-2 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}