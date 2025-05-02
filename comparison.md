# Document Submission Comparison: Automated vs Manual

This document compares how documents are submitted to the database in both the automated extraction system (Wingu Apps Statutory Extractor) and the manual UI upload process.

## 1. Automated Document Extraction (WinguAppsStatutoryExtractor.mjs)

### Process Flow

1. **Document Download**
   - Uses Playwright to automate browser interactions with Wingu Apps
   - Navigates to specific document export pages
   - Clicks download buttons to retrieve statutory documents
   - Downloads files to local storage first

2. **File Processing**
   - Processes CSV files to ensure proper formatting
   - Creates organized folder structure based on month/year
   - Generates standardized filenames with timestamps

3. **Database Submission**
   - Uploads files to Supabase storage bucket 'statutory-documents'
   - Creates a storage path: `${companyName}/${docType.filePrefix}_${timestamp}${fileExtension}`
   - Sets appropriate content type based on file extension
   - Retrieves public URL for the uploaded document

4. **Database Record Update**
   ```javascript
   // First get the current record to ensure we have the latest data
   const { data: currentRecord, error: fetchError } = await supabaseClient
       .from('company_payroll_records')
       .select('documents, status')
       .eq('id', company.id)
       .single();


   // Prepare the documents object with existing documents
   const currentDocuments = currentRecord?.documents || {};
   const updatedDocuments = {
       ...currentDocuments,
       [docType.dbField]: downloadPath
   };

   // Update the record with new documents and status
   const { error } = await supabaseClient
       .from('company_payroll_records')
       .update({
           documents: updatedDocuments,
           status: updatedStatus
       })
       .eq('id', company.id);
   ```

5. **Status Updates**
   - Updates extraction status in the database
   - Sets flags like `extracted: true`, `wingu_extraction: true`
   - Records extraction date

## 2. Manual UI Upload Process

### Process Flow

1. **Document Selection**
   - User selects file through DocumentUploadDialog component
   - Supports single file upload or bulk upload
   - Handles various document types (PDF, images, MPESA messages)

2. **File Processing**
   - Converts images to PDF if needed using client-side conversion
   - Generates MPESA receipts from text messages
   - Validates file types and content

3. **Database Submission**
   ```javascript
   // First, fetch the current record to get latest document paths
   const { data: currentRecord, error: fetchError } = await supabase
       .from('company_payroll_records')
       .select('documents')
       .eq('id', recordId)
       .single();

   const fileName = `${documentType}_${record.company.company_name}_${format(new Date(), 'yyyy-MM-dd')}${file.name.substring(file.name.lastIndexOf('.'))}`;
   const filePath = `${selectedMonthYear}/PREP DOCS/${record.company.company_name}/${fileName}`;

   // Upload file to storage
   const { data: uploadData, error: uploadError } = await supabase.storage
       .from('Payroll-Cycle')
       .upload(filePath, file, {
           cacheControl: '0',
           upsert: true
       });

   // Preserve existing document paths and update the new one
   const updatedDocuments = {
       ...currentRecord.documents,
       [documentType]: uploadData.path
   };

   // Update database record with merged document paths
   const { error: updateError } = await supabase
       .from('company_payroll_records')
       .update({
           documents: updatedDocuments
       })
       .eq('id', recordId);
   ```

4. **User Feedback**
   - Provides toast notifications for success/failure
   - Shows upload progress indicators
   - Allows document preview before submission

## 3. Key Differences

| Feature | Automated Extraction | Manual Upload |
|---------|----------------------|--------------|
| **Storage Bucket** | 'statutory-documents' | 'Payroll-Cycle' |
| **File Path Format** | `${companyName}/${docType.filePrefix}_${timestamp}${fileExtension}` | `${selectedMonthYear}/PREP DOCS/${record.company.company_name}/${fileName}` |
| **Status Updates** | Updates extraction status flags | No status flag updates |
| **File Processing** | Server-side CSV processing | Client-side image-to-PDF conversion |
| **Error Handling** | Retries failed downloads | Shows error toasts to user |
| **Document Types** | Fixed set (PAYE, NSSF, SHIF, Housing Levy, Payslips) | Flexible, user-selected document types |

## 4. Database Schema Impact

Both approaches update the same `company_payroll_records` table, but with different patterns:

1. **Document Storage**
   - Both store document paths in the `documents` JSON field
   - Both preserve existing document paths when updating
   - Both use different storage buckets

2. **Status Tracking**
   - Automated extraction updates the `status` JSON field with extraction metadata
   - Manual upload doesn't modify the status field

## 5. Recommendations for Alignment

1. **Standardize on Payroll-Cycle Storage Bucket**
   - Update the automated extraction to use the 'Payroll-Cycle' bucket instead of 'statutory-documents'
   - Implement the same file path pattern: `${selectedMonthYear}/PREP DOCS/${record.company.company_name}/${fileName}`

2. **Status Field Updates**
   - Add status updates to manual uploads to track document source
   - Standardize status field structure

3. **Error Handling**
   - Implement consistent error handling and retry logic
   - Standardize error reporting

4. **Document Type Mapping**
   - Ensure document type fields are consistent between both systems
   - Create a shared document type enumeration
