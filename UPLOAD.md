# Payment Slips Upload Documentation

This document explains the process of uploading payment slips and receipts to the database in the KRA Tools application.

## Database Structure

### Table: `company_payroll_records`

Payment documents are stored in JSON columns in the Supabase database:

| Column Name | Type | Description |
|-------------|------|-------------|
| `payment_receipts_documents` | JSON | Stores payment receipt documents (PAYE, Housing Levy, NITA, SHIF, NSSF) |
| `payment_slips_documents` | JSON | Stores payment slip documents |

### JSON Structure

```json
{
  "payment_receipts_documents": {
    "paye_receipt": "path/to/file.pdf",
    "housing_levy_receipt": "path/to/file.pdf",
    "nita_receipt": "path/to/file.pdf",
    "shif_receipt": "path/to/file.pdf",
    "nssf_receipt": "path/to/file.pdf"
  }
}
```

## Storage Structure

Files are uploaded to the Supabase storage bucket named `Payroll-Cycle` with the following path structure:

### Payment Receipts

```
{month_year}/{subFolder}/{company_name}/{filename}
```

Example:
```
2023-01/PAYMENT RECEIPTS/acme_inc/paye_receipt - Acme Inc - 2023-01-15.pdf
```

### Payment Slips

```
{month_year}/{subFolder}/{company_name}/{filename}
```

Example:
```
2023-01/payment_slips/acme_inc/paye_slip - Acme Inc - 2023-01-15.pdf
```

## Component Flow

### 1. Parent Component: `PayslipPaymentReceipts.tsx`

This component:
- Manages the state of payroll records
- Provides handlers for document upload/delete
- Passes these handlers to the table component

```tsx
// Key props passed to PayslipPaymentReceiptsTable
<PayslipPaymentReceiptsTable
  records={filteredRecords}
  onDocumentUpload={handleDocumentUploadWithFolderAndRefresh}
  onDocumentDelete={handleDocumentDeleteWithLocalUpdate}
  onStatusUpdate={handleStatusUpdateWithLocalUpdate}
  loading={loading}
  setPayrollRecords={setPayrollRecords}
  columnVisibility={columnVisibility}
/>
```

### 2. Table Component: `PayslipPaymentReceiptsTable.tsx`

This component:
- Renders the table with document upload dialogs
- Handles local document upload logic
- Passes upload handlers to the DocumentUploadDialog

```tsx
// Document upload function
const handleLocalDocumentUpload = async (recordId: string, file: File, documentType: DocumentType): Promise<void> => {
  try {
    // Validate file...
    
    // Create file path
    const safeName = record.company.company_name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'unknown';
    const timestamp = new Date().getTime();
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const fileName = `${safeName}_${documentType}_${timestamp}.${fileExtension}`;
    
    // Create storage path
    const filePath = `payslip_receipts/${safeName}/${recordId}/${documentType}/${fileName}`;
    
    // Upload to Supabase storage
    const { data: uploadData } = await supabase.storage
      .from('Payroll-Cycle')
      .upload(filePath, file, {
        cacheControl: '0',
        upsert: true
      });
    
    // Update database record
    const updatedDocuments = {
      ...record.payment_receipts_documents,
      [documentType]: uploadData.path
    };
    
    await supabase
      .from('company_payroll_records')
      .update({
        payment_receipts_documents: updatedDocuments
      })
      .eq('id', recordId);
    
    // Update local state
    // ...
  } catch (error) {
    // Handle error
  }
};
```

### 3. Upload Dialog: `DocumentUploadDialog.tsx`

This component:
- Provides the UI for file selection
- Handles file validation
- Calls the upload handler from the parent

```tsx
// Key props received by DocumentUploadDialog
<DocumentUploadDialog
  documentType="paye_receipt"
  recordId={record.id}
  onUpload={(file) => handleLocalDocumentUpload(record.id, file, 'paye_receipt')}
  onDelete={() => handleDocumentDelete(record.id, 'paye_receipt')}
  existingDocument={record.payment_receipts_documents?.paye_receipt || null}
  label={DOCUMENT_LABELS['paye_receipt']}
  isNilFiling={record.status?.finalization_date === 'NIL'}
  allDocuments={getDocumentsForUpload(record)}
  companyName={record.company?.company_name || 'Unknown'}
/>
```

## Implementation Functions

The application provides dedicated functions for handling both payment slips and payment receipts documents:

### Payment Receipts Upload Functions

```tsx
// Upload function for payment receipts
const handlePaymentReceiptsDocumentUpload = async (
    recordId: string,
    file: File,
    documentType: DocumentType,
    subFolder: string
) => {
    try {
        // Find the record in our state
        const record = payrollRecords.find(r => r.id === recordId)
        if (!record) {
            throw new Error('Record not found')
        }

        // If this is a temporary record, we need to create a real record first
        let realRecordId = recordId

        if (record.is_temporary) {
            // Create a new record in the database
            const { data: newRecord, error: insertError } = await supabase
                .from('company_payroll_records')
                .insert([
                    {
                        company_id: record.company_id,
                        payroll_cycle_id: record.payroll_cycle_id,
                        payment_receipts_documents: {},
                        documents: {},
                        status: {
                            finalization_date: null,
                            assigned_to: null,
                            filing: null
                        },
                        number_of_employees: 0
                    }
                ])
                .select()
                .single()

            if (insertError) throw insertError
            realRecordId = newRecord.id

            // Update our record with the real ID
            record.id = realRecordId
            record.is_temporary = false
        }

        // Ensure we're using the correct month-year format for the file path
        const fileExtension = file.name.substring(file.name.lastIndexOf('.'))
        const fileName = `${documentType} - ${record.company.company_name} - ${format(new Date(), 'yyyy-MM-dd')}${fileExtension}`
        
        // Create storage path using month-year format
        const filePath = `${selectedMonthYear}/${subFolder}/${record.company.company_name}/${fileName}`

        // Upload file to storage and update database
        // ...
    } catch (error) {
        // Error handling
    }
}

// Delete function for payment receipts
const handlePaymentReceiptsDocumentDelete = async (recordId: string, documentType: DocumentType) => {
    try {
        // Find the record and validate
        // Delete from storage
        // Update database
        // Update local state
    } catch (error) {
        // Error handling
    }
}
```

### Payment Slips Upload Functions

```tsx
// Upload function for payment slips
const handlePaymentSlipsDocumentUpload = async (
    recordId: string,
    file: File,
    documentType: DocumentType,
    subFolder: string
) => {
    try {
        // Find the record in our state
        const record = payrollRecords.find(r => r.id === recordId)
        if (!record) {
            throw new Error('Record not found')
        }

        // Ensure we're using the correct month-year format for the file path
        const fileExtension = file.name.substring(file.name.lastIndexOf('.'))
        const fileName = `${documentType} - ${record.company.company_name} - ${format(new Date(), 'yyyy-MM-dd')}${fileExtension}`
        const filePath = `${selectedMonthYear}/${subFolder}/${record.company.company_name}/${fileName}`

        // Upload file to storage and update database
        // ...
    } catch (error) {
        // Error handling
    }
}
```

### Key Differences Between Payment Slips and Payment Receipts

1. **Storage Path Structure**:
   - Both use the same structure: `{month_year}/{subFolder}/{company_name}/{filename}`

2. **Filename Format**:
   - Both use the same format: `{documentType} - {company_name} - {date}.{extension}`

3. **Database Column**:
   - Payment Slips: Updates the `payment_slips_documents` JSON column
   - Payment Receipts: Updates the `payment_receipts_documents` JSON column

4. **Implementation Functions**:
   - Payment Slips: Uses `handlePaymentSlipsDocumentUpload` and `handlePaymentSlipsDocumentDelete`
   - Payment Receipts: Uses `handlePaymentReceiptsDocumentUpload` and `handlePaymentReceiptsDocumentDelete`

These implementations ensure consistency across the application while maintaining separation between payment slips and payment receipts data.

## Document Extraction Process

The application includes functionality to extract data from uploaded documents:

1. **Automatic Extraction**:
   - When a document is uploaded, the system attempts to extract key information such as:
     - Payment amount
     - Payment date
     - Payment mode (e.g., bank transfer, M-Pesa)
     - Bank name (if applicable)

2. **M-Pesa Message Conversion**:
   - The DocumentUploadDialog supports direct input of M-Pesa messages
   - These messages are converted to PDF documents using the `mpesaMessageToPdf` utility
   - Example implementation:
   ```tsx
   const handleMpesaConvert = async () => {
     try {
       setIsConverting(true);
       const formattedMessage = formatMpesaMessage(mpesaMessage);
       const pdfBlob = await mpesaMessageToPdf(formattedMessage, documentType);
       const pdfFile = new File([pdfBlob], `${companyName}_${documentType}_mpesa.pdf`, { type: 'application/pdf' });
       setSelectedFile(pdfFile);
       setMpesaPreview(URL.createObjectURL(pdfBlob));
       setUploadType('file');
     } catch (error) {
       toast({
         title: 'Error',
         description: 'Failed to convert M-Pesa message to PDF',
         variant: 'destructive'
       });
     } finally {
       setIsConverting(false);
     }
   };
   ```

3. **Preview Extraction**:
   - The `PreviewExtractionDialog` component allows users to review and confirm extracted data
   - This ensures accuracy before the data is saved to the database

## Implementation Details

### File Validation

The application performs several validation checks before uploading:

```tsx
// Validate file size (10MB limit)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
if (file.size > MAX_FILE_SIZE) {
  toast({
    title: 'Error',
    description: 'File size exceeds 10MB limit',
    variant: 'destructive'
  });
  throw new Error('File size exceeds 10MB limit');
}

// Validate file type (PDF or images only)
const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
if (!allowedTypes.includes(file.type)) {
  toast({
    title: 'Error',
    description: 'Only PDF and image files are allowed',
    variant: 'destructive'
  });
  throw new Error('Invalid file type. Only PDF and image files are allowed');
}
```

### Image to PDF Conversion

When users upload image files, they are automatically converted to PDF for consistent storage:

```tsx
const convertImageToPdf = async (imageFile: File): Promise<File> => {
  // Create canvas and draw image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  // Load image and set canvas dimensions
  
  // Convert to PDF using jsPDF
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    orientation: width > height ? 'l' : 'p',
    unit: 'px',
    format: [width, height]
  });
  
  // Add image to PDF and return as File object
  // ...
};
```

### Bulk Upload Implementation

The bulk upload process includes intelligent company matching:

```tsx
// Try to match filename with a company
const fileName = file.name.toLowerCase();

// Find matching company by name in the filename
const matchingRecord = records.find(record => {
  const companyName = record.company?.company_name?.toLowerCase() || '';
  return companyName && fileName.includes(companyName);
});
```

## Upload Process Flow

1. **User Interaction**:
   - User clicks on upload button in the table cell
   - DocumentUploadDialog opens
   - User selects a file

2. **File Validation**:
   - File size check (max 10MB)
   - File type check (PDF, JPEG, PNG)

3. **Upload to Storage**:
   - File is uploaded to Supabase storage bucket
   - Path is generated based on company name, record ID, and document type

4. **Database Update**:
   - The `payment_receipts_documents` JSON column is updated
   - The specific document type field is set to the file path

5. **UI Update**:
   - Local state is updated to reflect the change
   - UI shows the document as uploaded
   - Toast notification confirms success

## Bulk Upload Process

The application also supports bulk upload through the `BulkDocumentUpload` component:

```tsx
<BulkDocumentUpload
  open={bulkUploadDialogOpen}
  onClose={() => setBulkUploadDialogOpen(false)}
  records={filteredRecords}
  onDocumentUpload={handleDocumentUploadWithFolderAndRefresh}
  setPayrollRecords={setPayrollRecords}
  documentTypes={[
    { value: 'paye_receipt', label: 'PAYE Receipt' },
    { value: 'housing_levy_receipt', label: 'Housing Levy Receipt' },
    { value: 'nita_receipt', label: 'NITA Receipt' },
    { value: 'shif_receipt', label: 'SHIF Receipt' },
    { value: 'nssf_receipt', label: 'NSSF Receipt' }
  ]}
/>
```

## Error Handling

The upload process includes comprehensive error handling:
- File validation errors (size, type)
- Storage upload errors
- Database update errors

Each error is caught and displayed to the user via toast notifications.

## Document Types

The following document types are supported:

| Document Type | Label | Description |
|---------------|-------|-------------|
| `paye_receipt` | PAYE Receipt | Pay As You Earn tax receipt |
| `housing_levy_receipt` | Housing Levy Receipt | Housing development levy receipt |
| `nita_receipt` | NITA Receipt | National Industrial Training Authority receipt |
| `shif_receipt` | SHIF Receipt | Social Health Insurance Fund receipt |
| `nssf_receipt` | NSSF Receipt | National Social Security Fund receipt |

## Implementation Notes

1. **File Naming**: Files are named with a combination of company name, document type, and timestamp to ensure uniqueness.

2. **State Management**: The application uses local state updates after successful uploads to avoid unnecessary database queries.

3. **Nil Filing**: Records marked as "NIL" filing are handled differently in the UI, showing appropriate badges instead of upload buttons.

4. **Document Count**: The UI displays the count of uploaded documents (e.g., "3/5") to indicate progress.

## Security Considerations

1. **File Type Restrictions**:
   - Only specific file types are allowed (PDF, JPEG, PNG)
   - This helps prevent security vulnerabilities related to file uploads

2. **Size Limitations**:
   - Maximum file size is restricted to 10MB
   - This prevents denial of service attacks through large file uploads

3. **Storage Path Security**:
   - Company names are sanitized before being used in storage paths
   - Example: `const safeName = record.company.company_name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'unknown';`

## Performance Optimizations

1. **Local State Updates**:
   - After successful uploads, the local state is updated to avoid unnecessary database queries
   - This improves UI responsiveness and reduces server load

2. **Lazy Loading**:
   - Libraries like jsPDF are dynamically imported only when needed
   - Example: `const { jsPDF } = await import('jspdf');`

3. **Blob URL Management**:
   - Proper cleanup of Blob URLs to prevent memory leaks
   - Example: `URL.revokeObjectURL(url);`
