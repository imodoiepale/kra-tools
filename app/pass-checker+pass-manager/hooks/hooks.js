import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useCategories() {
    const [categories, setCategories] = useState({});
    const [activeCategory, setActiveCategory] = useState('KRA');
    const [activeSubCategory, setActiveSubCategory] = useState('Companies');

    const handleAddCategory = async (newCategory) => {
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

            // Refresh the categories from the database
            fetchCategories();
        } catch (error) {
            console.error('Error adding category:', error);
        }
    };

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('*');

            if (error) throw error;

            const categoriesMap = {};
            data.forEach(item => {
                if (!categoriesMap[item.category]) {
                    categoriesMap[item.category] = [];
                }
                categoriesMap[item.category].push(item.subcategory);
            });

            setCategories(categoriesMap);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    return {
        categories,
        activeCategory,
        setActiveCategory,
        activeSubCategory,
        setActiveSubCategory,
        handleAddCategory
    };
}

export function useItems(activeCategory, activeSubCategory) {
    const [items, setItems] = useState({});
    const [loading, setLoading] = useState(true);

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
                        .select(`id, ${Object.values(column_mappings).join(',')}`)
                        .order('id', { ascending: true });
    
                    if (error) throw error;
    
                    const key = `${category}_${subcategory}`;
                    allData[key] = data.map(item => {
                        const mappedItem = { id: item.id };
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

    const handleAddItem = async (newItem) => {
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

            await fetchAllDataForAllCategories();
        } catch (error) {
            console.error('Error adding item:', error);
        }
    };

    const handleEditItem = async (editedItem) => {
        try {
            if (!editedItem.id || isNaN(parseInt(editedItem.id))) {
                throw new Error('Invalid item ID');
            }

            const { data: mapping, error: mappingError } = await supabase
                .from('category_table_mappings')
                .select('table_name, column_mappings')
                .eq('category', activeCategory)
                .eq('subcategory', activeSubCategory)
                .single();

            if (mappingError) throw mappingError;

            const { table_name, column_mappings } = mapping;

            const updateData = {};
            for (const [key, value] of Object.entries(column_mappings)) {
                updateData[value] = editedItem[key];
            }

            const { error: updateError } = await supabase
                .from(table_name)
                .update(updateData)
                .eq('id', parseInt(editedItem.id));

            if (updateError) throw updateError;

            // Update the local state
            setItems(prevItems => {
                const key = `${activeCategory}_${activeSubCategory}`;
                const updatedItems = prevItems[key].map(item => 
                    item.id === editedItem.id ? editedItem : item
                );
                return { ...prevItems, [key]: updatedItems };
            });
        } catch (error) {
            console.error('Error editing item:', error);
            throw error;
        }
    };

    const handleDeleteItem = async (itemToDelete) => {
        try {
            if (!itemToDelete.id || isNaN(parseInt(itemToDelete.id))) {
                throw new Error('Invalid item ID');
            }

            const { data: mapping, error: mappingError } = await supabase
                .from('category_table_mappings')
                .select('table_name')
                .eq('category', activeCategory)
                .eq('subcategory', activeSubCategory)
                .single();

            if (mappingError) throw mappingError;

            const { table_name } = mapping;

            const { error: deleteError } = await supabase
                .from(table_name)
                .delete()
                .eq('id', parseInt(itemToDelete.id));

            if (deleteError) throw deleteError;

            // Update the local state
            setItems(prevItems => {
                const key = `${activeCategory}_${activeSubCategory}`;
                const updatedItems = prevItems[key].filter(item => item.id !== itemToDelete.id);
                return { ...prevItems, [key]: updatedItems };
            });
        } catch (error) {
            console.error('Error deleting item:', error);
            throw error;
        }
    };

    useEffect(() => {
        fetchAllDataForAllCategories();
    }, [activeCategory, activeSubCategory]);

    return {
        items,
        loading,
        handleAddItem,
        handleEditItem,
        handleDeleteItem,
        fetchAllDataForAllCategories
    };
}

export function useTables(categories) {
    const [dbTables, setDbTables] = useState([]);
    const [linkedTables, setLinkedTables] = useState({});
    const [missingTables, setMissingTables] = useState([]);

    const fetchAllData = async () => {
        try {
            const [dbTablesResult, linkedTablesResult] = await Promise.all([
                supabase.rpc('get_all_tables'),
                supabase.from('category_table_mappings').select('category, subcategory, table_name')
            ]);

            if (dbTablesResult.error) throw dbTablesResult.error;
            if (linkedTablesResult.error) throw linkedTablesResult.error;

            setDbTables((dbTablesResult.data.map(item => item.table_name) || []).sort());

            const tableMap = {};
            linkedTablesResult.data.forEach(item => {
                tableMap[`${item.category}_${item.subcategory}`] = item.table_name;
            });
            setLinkedTables(tableMap);

            const missing = [];
            Object.entries(categories).forEach(([category, subcategories]) => {
                subcategories.forEach(subcategory => {
                    const key = `${category}_${subcategory}`;
                    if (!tableMap[key]) {
                        missing.push({ category, subcategory });
                    }
                });
            });
            setMissingTables(missing);
        } catch (error) {
            console.error('Error fetching table data:', error);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [categories]);

    const handleLinkTable = async (selectedTable, columnMappings, category, subcategory) => {
        try {
            const { error } = await supabase
                .from('category_table_mappings')
                .upsert({
                    category: category,
                    subcategory: subcategory,
                    table_name: selectedTable,
                    column_mappings: columnMappings
                }, {
                    onConflict: 'category,subcategory'
                });

            if (error) throw error;

            await fetchAllData();
        } catch (error) {
            console.error('Error linking table:', error);
        }
    };

    const handleCreateNewTable = async (customTableName, category, subcategory) => {
        try {
            const tableName = customTableName || `${category}_${subcategory}`.toLowerCase();

            await supabase.rpc('create_table_if_not_exists', { table_name: tableName });

            await supabase.from('category_table_mappings').upsert({
                category: category,
                subcategory: subcategory,
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

            await fetchAllData();
        } catch (error) {
            console.error('Error creating new table:', error);
        }
    };

    return {
        dbTables,
        linkedTables,
        missingTables,
        handleLinkTable,
        handleCreateNewTable
    };
}