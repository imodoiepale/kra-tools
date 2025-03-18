## Bank Statement Upload Components Enhancement Todo

### BankStatementBulkUploadDialog & PasswordInputDialog Improvements

#### 1. File Upload UI/UX Enhancements

- [ ] Fix file name parsing and display

  - Implement proper file name extraction
  - Display full file name
  - Display file extension separately with subtle styling
- [ ] Enhance Upload Files Table

  - Make table scrollable with fixed header
  - Implement compact table design using ShadCN's compact variant
  - Add proper spacing and padding
  - Style action buttons with consistent colors:Process: blue-600

    Delete: red-600

    View: green-600
  - Add max-height with overflow-y-auto
  - Implement responsive design for mobile views

#### 2. File Processing Logic

- [ ] Fix "Process Files" functionality
  - Debug current processing pipeline
  - Add proper error handling
  - Implement progress indicators
  - Add retry mechanism for failed processes and ondes without data on the review and match table
  - Log processing steps for debugging

#### 3. Password Management Improvements

- [ ] Enhance Password Auto-detection

  - Improve file name parsing for password extraction
  - improve smart password detection algorithm
  - Add fallback mechanism when auto-detection fails
- [ ] Password Input UI

  - Remove common password suggestions section
  - Implement cleaner password input interface

#### 4. Extraction Process

- [ ] Implement Selective Re-extraction
  - Add logic to identify failed extractions
  - Implement re-extraction for failed items only
  - Add progress tracking for re-extraction
  - Preserve successful extractions

#### 5. Vouching Tab Enhancement

- [ ] Redesign Vouching Interface
  - Mirror validation interface design but now collapsable after we vouch each file ..also group them according to company name  if bulk upload
  - Add balance input fields
  - Implement real-time validation

### BankValidationDialog Improvements

#### 1. Dialog Flow Enhancement

- [ ] Implement Post-validation Flow
  - Auto-open BankExtractionDialog after "Proceed" or "Continue"
  - Preserve validation state
  - Add proper state management
  - Implement smooth transitions between dialogs

#### 2. Password Management Integration

- [ ] Add Password Handling Logic
  - Implement password disabling before save
  - Add password validation before extraction
  - Sync password state with file processing
  - Add proper error handling for password-related issues
