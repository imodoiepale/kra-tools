// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zyszsqgdlrpnunkegipk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5c3pzcWdkbHJwbnVua2VnaXBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwODMyNzg5NCwiZXhwIjoyMDIzOTAzODk0fQ.7ICIGCpKqPMxaSLiSZ5MNMWRPqrTr5pHprM0lBaNing';
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAutoPopulateFolders(bucketName) {
    const foldersToDelete = [];

    async function scanFolder(path = '') {
        console.log(`Scanning folder: ${path}`);
        const { data, error } = await supabase.storage.from(bucketName).list(path);
        if (error) {
            console.error(`Error listing items in ${path}:`, error);
            return [];
        }

        console.log(`Found ${data.length} items in ${path}`);

        const subFolderPromises = [];

        for (const item of data) {
            const fullPath = path ? `${path}/${item.name}` : item.name;
            console.log(`Checking item: ${fullPath}, is folder: ${!item.metadata}`);
            if (!item.metadata) { // It's a folder
                if (fullPath.toLowerCase().includes('auto-population') ||
                    fullPath.toLowerCase().includes('auto-populate')) {
                    console.log(`Found matching folder: ${fullPath}`);
                    foldersToDelete.push(fullPath);
                }
                // Add promise for scanning this subfolder
                subFolderPromises.push(scanFolder(fullPath));
            }
        }

        // Wait for all subfolders to be scanned
        await Promise.all(subFolderPromises);
    }

    try {
        console.log(`Starting concurrent folder scan in bucket: ${bucketName}`);
        await scanFolder();

        console.log(`Scan complete. Found ${foldersToDelete.length} folders to delete.`);

        if (foldersToDelete.length === 0) {
            console.log('No folders to delete. Exiting.');
            return;
        }

        // Display folders to be deleted
        console.log('Folders to be deleted:');
        foldersToDelete.forEach(folder => console.log(`- ${folder}`));

        // Perform bulk deletion
        console.log('Starting bulk deletion...');
        const { data, error } = await supabase.storage
            .from(bucketName)
            .remove(foldersToDelete);

        if (error) {
            console.error('Error during bulk deletion:', error);
        } else {
            console.log(`Deletion response:`, data);
            console.log(`Successfully initiated deletion for ${foldersToDelete.length} folders.`);
        }

        // Verify deletion
        console.log('Verifying deletion...');
        for (const folder of foldersToDelete) {
            const { data: checkData, error: checkError } = await supabase.storage
                .from(bucketName)
                .list(folder);
            
            if (checkError) {
                console.log(`Folder ${folder} appears to be deleted (error on list)`);
            } else if (checkData && checkData.length === 0) {
                console.log(`Folder ${folder} is empty or deleted`);
            } else {
                console.log(`Folder ${folder} still exists or is not empty`);
            }
        }

        console.log('Deletion process and verification completed.');
    } catch (error) {
        console.error('An unexpected error occurred:', error);
    }
}

// Main execution
(async () => {
    try {
        await deleteAutoPopulateFolders('kra-documents');
    } catch (error) {
        console.error('Failed to execute deletion script:', error);
    }
})();