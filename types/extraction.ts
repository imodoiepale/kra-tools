// Types for document extraction functionality

// Array configuration for complex field types
export interface ArrayConfig {
  fields?: {
    id: string;
    name: string;
    type: string;
  }[];
  id: string;
  name: string;
  type: string;
}

// Field definition for document extraction
export interface Field {
  id: string;
  name: string;
  type: string;
  arrayConfig?: ArrayConfig;
  required?: boolean;
}

// Document definition
export interface Document {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  fields?: Field[];
}

// Result of extraction process
export interface ExtractionResult {
  [key: string]: any;
  // Additional common properties can be added here as needed
}

// Conversion response for file processing
export interface ConversionResponse {
  success: boolean;
  message: string;
  image_base64?: string;
  mime_type?: string;
  width?: number;
  height?: number;
  processed_at?: string;
}

// Structure for an individual extracted field
export interface ExtractedField {
  name: string;
  value: any;
  confidence?: number;
}

// API response choice structure
export interface ExtractionChoice {
  message: {
    content: string;
  };
  content: string;
}

// API response structure
export interface ExtractionAPIResponse {
  choices: ExtractionChoice[];
}

// Validation error structure
export interface ValidationError {
  field: string;
  error: string;
}
