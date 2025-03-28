import { supabase } from '@/lib/supabase';

export const handleFileUpload = async (file, activeCategory, activeSubCategory) => {
    if (file) {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async (e) => {
                const csv = e.target.result;
                const rows = csv.split('\n').map(row => row.split(','));
                const headers = rows[0].map(header => header.trim().toLowerCase());
                console.log('CSV Headers:', headers);

                const data = rows.slice(1)
                    .map(row => {
                        const obj = {};
                        headers.forEach((header, index) => {
                            const value = row[index];
                            obj[header] = (value === undefined || value.trim() === '') ? null : value.trim();
                        });
                        return obj;
                    })
                    .filter(row => Object.values(row).some(value => value !== null)); // Skip empty rows

                console.log('Parsed CSV data:', data);

                if (data.length === 0) {
                    reject(new Error('No valid data to insert'));
                    return;
                }

                try {
                    const { data: mapping, error: mappingError } = await supabase
                        .from('category_table_mappings')
                        .select('table_name, column_mappings')
                        .eq('category', activeCategory)
                        .eq('subcategory', activeSubCategory)
                        .single();

                    if (mappingError) throw mappingError;

                    const { table_name, column_mappings } = mapping;
                    console.log('Table name:', table_name);
                    console.log('Column mappings:', column_mappings);

                    // Fetch table information to get nullable columns
                    const { data: tableInfo, error: tableInfoError } = await supabase
                        .rpc('get_table_columns', { input_table_name: table_name });

                    if (tableInfoError) throw tableInfoError;

                    const nullableColumns = tableInfo
                        .filter(col => col.is_nullable)
                        .map(col => col.column_name);

                    console.log('Nullable columns:', nullableColumns);

                    const insertData = data.map(item => {
                        const mappedItem = {};
                        for (const [csvColumn, dbColumn] of Object.entries(column_mappings)) {
                            const value = item[csvColumn.toLowerCase()];
                            // If the column is nullable, allow null values. Otherwise, use an empty string for null values.
                            mappedItem[dbColumn] = value === null && !nullableColumns.includes(dbColumn) ? '' : value;
                        }
                        return mappedItem;
                    });

                    console.log('Data to be inserted:', insertData);

                    const { data: insertedData, error } = await supabase
                        .from(table_name)
                        .insert(insertData);

                    if (error) throw error;

                    console.log('CSV data uploaded successfully');
                    resolve(insertedData);
                } catch (error) {
                    console.error('Error uploading CSV data:', error);
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }
};

export const downloadTemplate = async (activeCategory, activeSubCategory) => {
    try {
        const { data: mapping, error: mappingError } = await supabase
            .from('category_table_mappings')
            .select('column_mappings')
            .eq('category', activeCategory)
            .eq('subcategory', activeSubCategory)
            .single();

        if (mappingError) throw mappingError;

        const { column_mappings } = mapping;
        const headers = Object.keys(column_mappings);

        const templateData = [
            headers,
            headers.map(() => '') // Empty row for example
        ];

        const csvContent = templateData.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${activeCategory}_${activeSubCategory}_template.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error generating template:', error);
        throw error;
    }
};