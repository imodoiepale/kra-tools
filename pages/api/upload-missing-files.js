// @ts-nocheck
import { IncomingForm } from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

// Configure Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Disable the default body parser to handle form data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Parse form data
    const data = await parseForm(req);
    const { fields, files } = data;
    
    const companyName = fields.companyName;
    const companyId = fields.companyId;
    
    if (!companyName) {
      return res.status(400).json({ message: 'Company name is required' });
    }

    // Get the previous month name (same format as in auto-population.js)
    const previousMonth = getPreviousMonthName();
    const monthYear = previousMonth;
    const extractionDate = new Date().toISOString();
    
    // Upload files to Supabase storage
    const uploadedFiles = await uploadFilesToSupabase(files, companyName, monthYear);
    
    // Update Supabase database with file information
    await updateSupabaseDatabase(companyName, companyId, monthYear, extractionDate, uploadedFiles);
    
    return res.status(200).json({ 
      message: 'Files uploaded successfully',
      uploadedFiles
    });
  } catch (error) {
    console.error('Error processing upload:', error);
    return res.status(500).json({ 
      message: 'Failed to upload files',
      error: error.message
    });
  }
}

// Parse form data using formidable
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      multiples: true,
      keepExtensions: true,
    });
    
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

// Upload files to Supabase storage
async function uploadFilesToSupabase(files, companyName, monthYear) {
  const uploadedFiles = [];
  
  // Define file types and their patterns
  const filePatterns = {
    vat3: /VAT3_Return/i,
    sec_b_with_vat: /SEC_B_WITH_VAT_PIN/i,
    sec_b_without_vat: /SEC_B_WITHOUT_PIN/i,
    sec_f: /SEC_F_WITH_VAT_PIN/i
  };
  
  // Process each file type (vat3, sec_b_with_vat, etc.)
  for (const fileType of Object.keys(filePatterns)) {
    const file = files[fileType]?.[0] || files[fileType]; // Handle both array and single file
    
    if (!file) continue; // Skip if no file for this type
    
    try {
      // Prepare file name with appropriate prefix based on type
      let fileName = path.basename(file.filepath);
      const fileExt = path.extname(fileName);
      
      // Rename file to match expected pattern
      if (fileType === 'vat3') {
        fileName = `VAT3_Return${fileExt}`;
      } else if (fileType === 'sec_b_with_vat') {
        fileName = `SEC_B_WITH_VAT_PIN${fileExt}`;
      } else if (fileType === 'sec_b_without_vat') {
        fileName = `SEC_B_WITHOUT_PIN${fileExt}`;
      } else if (fileType === 'sec_f') {
        fileName = `SEC_F_WITH_VAT_PIN${fileExt}`;
      }
      
      const storagePath = `${companyName}/auto-populate/${monthYear}/${fileName}`;
      
      // Read file content
      const fileContent = await fs.readFile(file.filepath);
      
      // Determine content type
      const contentType = determineContentType(file.mimetype, fileName);
      
      // Delete existing file if it exists
      await supabase.storage
        .from('kra-documents')
        .remove([storagePath])
        .catch(() => {}); // Ignore errors if file doesn't exist
      
      // Upload file to Supabase storage
      const { data, error } = await supabase.storage
        .from('kra-documents')
        .upload(storagePath, fileContent, {
          contentType,
          upsert: true
        });
      
      if (error) throw error;
      
      // Get public URL
      const publicUrl = getPublicUrl(storagePath);
      
      // Add file to uploaded files list
      uploadedFiles.push({
        name: fileName,
        originalName: fileName,
        path: storagePath,
        fullPath: publicUrl,
        type: fileType,
        size: file.size,
        contentType
      });
      
      console.log(`Successfully uploaded: ${fileName}`);
    } catch (error) {
      console.error(`Error uploading ${fileType} file:`, error);
      // Continue with other files even if one fails
    }
  }
  
  return uploadedFiles;
}

// Update Supabase database with file information
async function updateSupabaseDatabase(companyName, companyId, monthYear, extractionDate, uploadedFiles) {
  try {
    // Check if company exists in Autopopulate table
    const { data: existingCompany } = await supabase
      .from('Autopopulate')
      .select('id, extractions')
      .eq('company_name', companyName)
      .single();
    
    if (existingCompany) {
      // Update existing company
      const extractions = existingCompany.extractions || {};
      
      // Update or create the extraction for the current month
      extractions[monthYear] = {
        extraction_date: extractionDate,
        files: uploadedFiles
      };
      
      const { error } = await supabase
        .from('Autopopulate')
        .update({
          extractions,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingCompany.id);
      
      if (error) throw error;
    } else {
      // Create new company entry
      const extractions = {
        [monthYear]: {
          extraction_date: extractionDate,
          files: uploadedFiles
        }
      };
      
      const { error } = await supabase
        .from('Autopopulate')
        .insert({
          company_name: companyName,
          extractions,
          last_updated: new Date().toISOString()
        });
      
      if (error) throw error;
    }
    
    console.log(`Successfully updated database for ${companyName}`);
  } catch (error) {
    console.error('Error updating database:', error);
    throw error;
  }
}

// Helper function to determine content type
function determineContentType(mimeType, fileName) {
  if (mimeType) return mimeType;
  
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.xls': return 'application/vnd.ms-excel';
    case '.csv': return 'text/csv';
    case '.zip': return 'application/zip';
    default: return 'application/octet-stream';
  }
}

// Helper function to get public URL
function getPublicUrl(path) {
  return `${supabaseUrl}/storage/v1/object/public/kra-documents/${path}`;
}

// Helper function to get previous month name
function getPreviousMonthName() {
  const currentDate = new Date();
  const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  return format(previousMonthDate, 'MMMM yyyy');
}
