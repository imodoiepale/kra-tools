'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function deleteAllBankStatements() {
  try {
    console.log('Starting deletion of all bank statements...');
    
    // First, delete all bank statement records from the database
    const { data: deleteData, error: deleteError } = await supabase
      .from('acc_cycle_bank_statements')
      .delete()
      .not('id', 'is', null); // Delete all records where id is not null

    console.log('Delete operation result:', { deleteData, deleteError });
    
    if (deleteError) {
      console.error('Database deletion error:', deleteError);
      throw new Error(`Database error: ${deleteError.message}`);
    }

    // Get all files from storage bucket
    console.log('Fetching files from storage...');
    const { data: files, error: listError } = await supabase.storage
      .from('Statement-Cycle')
      .list('', { limit: 1000 }); // Increase limit to ensure we get all files

    if (listError) {
      console.error('Storage list error:', listError);
      throw new Error(`Storage list error: ${listError.message}`);
    }

    console.log(`Found ${files.length} files to delete`);

    // Delete all files from storage in batches if necessary
    if (files.length > 0) {
      const filePaths = files.map(file => file.name);
      console.log('Deleting files:', filePaths);
      
      const { error: deleteFilesError } = await supabase.storage
        .from('Statement-Cycle')
        .remove(filePaths);

      if (deleteFilesError) {
        console.error('File deletion error:', deleteFilesError);
        throw new Error(`File deletion error: ${deleteFilesError.message}`);
      }
    }

    // Also clear any cached data or related tables if needed
    try {
      // Clear any related metadata if it exists
      const { error: metaDeleteError } = await supabase
        .from('statement_cycles')
        .delete()
        .not('id', 'is', null); // Delete all records where id is not null
        
      if (metaDeleteError) {
        console.warn('Warning: Could not clear statement cycles:', metaDeleteError);
      }
    } catch (metaError) {
      console.warn('Warning when cleaning up statement cycles:', metaError);
    }

    // Revalidate the page to reflect changes
    revalidatePath('/payroll/bank-statements');
    
    console.log('Successfully deleted all bank statements and files');
    return { 
      success: true, 
      message: 'Successfully deleted all bank statements and files across all periods',
      timestamp: new Date().toISOString() // Add timestamp to force refresh
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in deleteAllBankStatements:', error);
    return { 
      success: false, 
      message: `Failed to delete bank statements: ${errorMessage}`,
      details: error instanceof Error ? error.stack : undefined
    };
  }
}
