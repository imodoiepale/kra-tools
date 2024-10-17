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
    
        console.log('Adding category:', categoryName, 'with subcategories:', subcategoriesList);
    
        try {
            // Create tables for each subcategory
            const results = await Promise.all(
                subcategoriesList.map(async (subcategory) => {
                    const tableName = `${categoryName}_${subcategory}`.toLowerCase();
                    console.log('Creating table:', tableName);
                    const { data, error } = await supabase.rpc('create_table_if_not_exists', { table_name: tableName });
                    if (error) throw error;
    
                    // Insert into category_table_mappings
                    const { error: mappingError } = await supabase
                        .from('category_table_mappings')
                        .upsert({
                            category: categoryName,
                            subcategory: subcategory,
                            table_name: tableName,
                            column_mappings: {
                                name: 'name',
                                identifier: 'identifier',
                                password: 'password',
                                status: 'status'
                            },
                            column_settings: {}
                        }, {
                            onConflict: 'category,subcategory'
                        });
                    if (mappingError) throw mappingError;
    
                    return { tableName, subcategory };
                })
            );
    
            console.log('Table creation and mapping results:', results);
    
            // Update local state
            setCategories(prev => {
                const newCategories = {
                    ...prev,
                    [categoryName]: subcategoriesList
                };
                console.log('Updated categories:', newCategories);
                return newCategories;
            });
    
            // Refresh the categories from the database
            await fetchCategories();
        } catch (error) {
            console.error('Error adding category:', error);
            alert(`Error adding category: ${error.message || 'Unknown error'}`);
        }
    };

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('category_table_mappings')
                .select('*');

            if (error) throw error;

            console.log('Fetched category data:', data);

            const categoriesMap = {};
            data.forEach(item => {
                if (!categoriesMap[item.category]) {
                    categoriesMap[item.category] = [];
                }
                categoriesMap[item.category].push(item.subcategory);
            });

            console.log('Processed categories:', categoriesMap);
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
    
            console.log('Fetched mappings:', mappings);

            const allData = {};
            await Promise.all(
                mappings.map(async ({ category, subcategory, table_name, column_mappings }) => {
                    console.log(`Fetching data for ${category}_${subcategory} from table ${table_name}`);
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
                    console.log(`Processed data for ${key}:`, allData[key]);
                })
            );
            setItems(allData);
            console.log('All data fetched and processed:', allData);
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

            console.log('Fetched DB tables:', dbTablesResult.data);
            console.log('Fetched linked tables:', linkedTablesResult.data);

            setDbTables((dbTablesResult.data.map(item => item.table_name) || []).sort());

            const tableMap = {};
            linkedTablesResult.data.forEach(item => {
                tableMap[`${item.category}_${item.subcategory}`] = item.table_name;
            });
            setLinkedTables(tableMap);
            console.log('Processed linked tables:', tableMap);

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
            console.log('Missing tables:', missing);
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
            console.log('Creating table:', tableName);
    
            const { data: createTableData, error: createTableError } = await supabase.rpc('create_table_if_not_exists', { table_name: tableName });
            console.log('Create table result:', createTableData);
            if (createTableError) {
                console.error('Error creating table:', createTableError);
                throw createTableError;
            }
    
            // Verify table creation
            const { data: tableExists, error: tableCheckError } = await supabase
                .from('information_schema.tables')
                .select('table_name')
                .eq('table_name', tableName)
                .single();
    
            if (tableCheckError || !tableExists) {
                throw new Error('Table creation could not be verified');
            }
    
            const payload = {
                category: category,
                subcategory: subcategory,
                table_name: tableName,
                column_mappings: {
                    name: 'name',
                    identifier: 'identifier',
                    password: 'password',
                    status: 'status'
                },
                column_settings: {}
            };
            console.log('Upserting payload:', payload);
    
            const { data: upsertData, error: upsertError } = await supabase
                .from('category_table_mappings')
                .upsert(payload, {
                    onConflict: 'category,subcategory',
                    returning: 'minimal'
                });
    
            console.log('Upsert result:', upsertData);
    
            if (upsertError) {
                console.error('Error upserting into category_table_mappings:', upsertError);
                throw upsertError;
            }
    
            await fetchAllData();
    
            console.log('Table created and mapping updated successfully.');
            alert('Table created and mapping updated successfully.');
        } catch (error) {
            console.error('Error creating new table:', error);
            alert(`Error creating table: ${error.message || 'Unknown error'}`);
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