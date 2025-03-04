# KRA Tools Implementation Instructions

## Auto-Population Feature Implementation

### 1. Company Validation Logic
- Implement strict validation for company KRA PINs
  - Only process companies with PINs starting with 'P'
  - Ensure KRA password is present and valid
  - Skip companies that don't meet these criteria with appropriate error messages

### 2. Error Handling and Reporting
- Add detailed error messages in the Excel report
- Use consistent color coding for different status messages:
  - Red (FF7474) for validation failures
  - Light blue (FFADD8E6) for company headers
  - Green (4CB944) for successful operations

### 3. Documentation Updates
- Maintain clear documentation of changes in changelog
- Update feature specifications and requirements
- Document validation rules and error messages

### 4. Testing Guidelines
- Test with various company data scenarios:
  - Companies with valid P-starting PINs
  - Companies with invalid or non-P PINs
  - Companies with missing passwords
  - Companies with all valid credentials

## Password Check Reports Enhancement

### 1. UI Component Structure
- Implement responsive tab organization
  - Use ShadCN Tabs component for main navigation
  - Ensure proper spacing and alignment of tab elements
  - Add loading state indicator during data fetching

### 2. Data Management
- Implement efficient data fetching and sorting
  - Default sort by company name
  - Add credential validation per tab type
  - Maintain data consistency across tab switches
  - Handle empty states appropriately

### 3. Visual Enhancements
- Apply consistent styling using ShadCN theme
  - Use primary colors for header elements
  - Apply appropriate hover states
  - Implement responsive design patterns
  - Add visual indicators for data completeness

### 4. Date Handling
- Implement relative time formatting
  - Show time ago for last checked dates
  - Maintain full date information in tooltips
  - Handle invalid or missing dates gracefully

### 5. Testing Guidelines
- Test across different scenarios:
  - Empty data states
  - Various tab switches
  - Different screen sizes
  - Data loading states
  - Sort and filter combinations
  - Date formatting edge cases

### 6. Performance Considerations
- Optimize data fetching
- Implement efficient filtering
- Maintain smooth tab transitions
- Handle large datasets appropriately

## Email Communication Enhancement

### 1. Email Service Implementation
- Implement robust EmailService class
  - Add retry mechanism with 3 attempts
  - Include offline detection
  - Handle network errors gracefully
  - Implement comprehensive error reporting

### 2. Contact Modal Enhancement
- Redesign email modal for better usability
  - Implement landscape layout
  - Add To, CC, BCC fields
  - Include subject line
  - Add large message area
  - Support document attachments
  - Add file upload capability

### 3. Document Integration
- Integrate with existing document system
  - Auto-attach company documents
  - Support additional file uploads
  - Show visual indicators for attachments
  - Handle document loading errors

### 4. Error Handling
- Implement comprehensive error handling
  - Show network status
  - Display loading states
  - Provide clear error messages
  - Handle offline scenarios
  - Support retry mechanisms

### 5. Testing Guidelines
- Test across different scenarios:
  - Online/offline states
  - Document attachment
  - Email validation
  - Network failures
  - File upload limits
  - Retry mechanisms

### 6. Performance Considerations
- Optimize file handling
- Implement efficient retry logic
- Handle large attachments
- Maintain responsive UI
