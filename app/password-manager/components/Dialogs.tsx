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

import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';


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
    setColumnSettings,
    updateColumnSettings,
    removeCategoryFromState
}) {
    const [activeTab, setActiveTab] = useState("categories");
    const [newCategory, setNewCategory] = useState({ name: '', subcategories: '' });
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubcategory, setSelectedSubcategory] = useState('');
    const [selectedTable, setSelectedTable] = useState('');
    const [columnMappings, setColumnMappings] = useState({});
    const [dbColumns, setDbColumns] = useState([]);
    const [newColumnName, setNewColumnName] = useState('');
    const [localColumnSettings, setLocalColumnSettings] = useState({});

    // New state for category deletion
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
            .select('column_mappings, table_name')
            .eq('category', selectedCategory)
            .eq('subcategory', selectedSubcategory)
            .single();

        if (error) {
            console.error('Error fetching column mappings:', error);
            return;
        }

        setColumnMappings(data.column_mappings || {});
        setSelectedTable(data.table_name || '');
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


    const handleAddColumn = async () => {
        if (!newColumnName) return;

        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('table_name, column_mappings')
                .eq('category', selectedCategory)
                .eq('subcategory', selectedSubcategory)
                .single();

            if (error) throw error;

            const { table_name, column_mappings } = data;

            // Add the new column to the actual database table
            const { error: alterTableError } = await supabase.rpc('add_column_to_table', {
                p_table_name: table_name,
                p_column_name: newColumnName.toLowerCase(),
                p_data_type: 'text'
            });

            if (alterTableError) throw alterTableError;

            // Update column mappings
            const updatedColumnMappings = {
                ...column_mappings,
                [newColumnName]: newColumnName.toLowerCase()
            };

            // Update the category_table_mappings with the new column_mappings
            const { error: updateError } = await supabase
                .from('category_table_mappings')
                .update({ column_mappings: updatedColumnMappings })
                .eq('category', selectedCategory)
                .eq('subcategory', selectedSubcategory);

            if (updateError) throw updateError;

            // Update local state
            setColumnMappings(updatedColumnMappings);
            setDbColumns([...dbColumns, newColumnName.toLowerCase()]);

            // Update column settings
            const currentSettings = columnSettings[`${selectedCategory}_${selectedSubcategory}`] || {};
            const newSettings = {
                ...currentSettings,
                visibleColumns: {
                    ...currentSettings.visibleColumns,
                    [newColumnName]: true  // Set new column to visible by default
                },
                headerNames: {
                    ...currentSettings.headerNames,
                    [newColumnName]: newColumnName
                }
            };
            updateColumnSettings(selectedCategory, selectedSubcategory, newSettings);

            setNewColumnName('');
        } catch (error) {
            console.error('Error adding new column:', error);
        }
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

    // const handleHeaderNameChange = (column, newName) => {
    //     const currentSettings = columnSettings[`${selectedCategory}_${selectedSubcategory}`] || {};
    //     const newSettings = {
    //         ...currentSettings,
    //         headerNames: {
    //             ...currentSettings.headerNames,
    //             [column]: newName
    //         }
    //     };
    //     updateColumnSettings(selectedCategory, selectedSubcategory, newSettings);
    // };

    const handleVisibilityChange = (column) => {
        setLocalColumnSettings(prevSettings => ({
            ...prevSettings,
            visibleColumns: {
                ...prevSettings.visibleColumns,
                [column]: !prevSettings.visibleColumns[column]
            }
        }));
    };

    const handleHeaderNameChange = (column, newName) => {
        setLocalColumnSettings(prevSettings => ({
            ...prevSettings,
            headerNames: {
                ...prevSettings.headerNames,
                [column]: newName
            }
        }));
    };

    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            await updateColumnSettings(selectedCategory, selectedSubcategory, localColumnSettings);
            alert('Changes saved successfully');
        } catch (error) {
            console.error('Error saving changes:', error);
            setSaveError('Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (selectedCategory && selectedSubcategory) {
            const currentSettings = columnSettings[`${selectedCategory}_${selectedSubcategory}`] || {
                visibleColumns: {},
                headerNames: {}
            };
            setLocalColumnSettings(currentSettings);
        }
    }, [selectedCategory, selectedSubcategory, columnSettings]);

    const onDragEnd = (result) => {
        if (!result.destination) {
            return;
        }

        const newColumnOrder = Array.from(localColumnSettings.columnOrder);
        const [reorderedItem] = newColumnOrder.splice(result.source.index, 1);
        newColumnOrder.splice(result.destination.index, 0, reorderedItem);

        setLocalColumnSettings(prevSettings => ({
            ...prevSettings,
            columnOrder: newColumnOrder
        }));
    };



    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
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
                            <div className="flex space-x-4">
                                <div>
                                    <Label>Category</Label>
                                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.keys(categories).map(category => (
                                                <SelectItem key={category} value={category}>{category}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Subcategory</Label>
                                    <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select subcategory" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories[selectedCategory]?.map(subcategory => (
                                                <SelectItem key={subcategory} value={subcategory}>{subcategory}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Linked Table</Label>
                                    <Select value={selectedTable} onValueChange={setSelectedTable}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select table" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {dbTables.map(table => (
                                                <SelectItem key={table} value={table}>{table}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {dbColumns.map((dbColumn) => {
                                    const categoryColumn = Object.entries(columnMappings).find(([_, value]) => value === dbColumn)?.[0];
                                    const isLinked = !!categoryColumn;

                                    return (
                                        <div key={dbColumn} className="flex items-center space-x-2">
                                            <Checkbox
                                                checked={isLinked && (localColumnSettings.visibleColumns?.[categoryColumn] ?? true)}
                                                onCheckedChange={(checked) => {
                                                    if (isLinked) {
                                                        handleVisibilityChange(categoryColumn);
                                                    } else if (checked) {
                                                        handleColumnMappingChange(dbColumn, dbColumn);
                                                    }
                                                }}
                                            />
                                            <Input
                                                value={isLinked ? localColumnSettings.headerNames?.[categoryColumn] || categoryColumn : dbColumn}
                                                onChange={(e) => isLinked && handleHeaderNameChange(categoryColumn, e.target.value)}
                                                className="w-1/3"
                                                disabled={!isLinked}
                                            />
                                            <Select
                                                value={categoryColumn || ''}
                                                onValueChange={(value) => handleColumnMappingChange(value, dbColumn)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={isLinked ? categoryColumn : 'Unlinked'} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.keys(columnMappings).map(col => (
                                                        <SelectItem key={col} value={col}>{col}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    );
                                })}
                            </div>
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