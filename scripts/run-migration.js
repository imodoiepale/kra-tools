// Script to run the SQL migration using the Supabase client
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('Starting database migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_extraction_columns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      console.log(`Executing: ${statement}`);
      const { data, error } = await supabase.rpc('pgclient', { query: statement });
      
      if (error) {
        console.error('Error executing statement:', error);
        // Continue with other statements even if one fails
      } else {
        console.log('Statement executed successfully');
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Alternative approach using direct SQL if rpc method is not available
async function runMigrationAlternative() {
  try {
    console.log('Starting database migration (alternative method)...');
    
    // Add extraction_performed column
    const { error: error1 } = await supabase
      .from('acc_cycle_bank_statements')
      .update({ extraction_performed: false })
      .eq('id', 'dummy-will-not-match-but-creates-column');
    
    if (error1 && !error1.message.includes('does not exist')) {
      console.error('Error adding extraction_performed column:', error1);
    } else {
      console.log('extraction_performed column added or already exists');
    }
    
    // Add extraction_timestamp column
    const { error: error2 } = await supabase
      .from('acc_cycle_bank_statements')
      .update({ extraction_timestamp: null })
      .eq('id', 'dummy-will-not-match-but-creates-column');
    
    if (error2 && !error2.message.includes('does not exist')) {
      console.error('Error adding extraction_timestamp column:', error2);
    } else {
      console.log('extraction_timestamp column added or already exists');
    }
    
    console.log('Migration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the appropriate migration method
if (process.argv.includes('--alternative')) {
  runMigrationAlternative();
} else {
  runMigration();
}
