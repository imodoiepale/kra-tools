// @ts-nocheck

import { supabase } from '@/lib/supabase'
import { GoogleGenerativeAI } from "@google/generative-ai";
import dayjs from 'dayjs'; // Import dayjs library
import { API_KEYS } from './apiKeys';


interface BatchDocumentInput {
  url: string;
  type: string;
  label: string;
}

// Initialize the Gemini API
let currentApiKeyIndex = 0;
let genAI = new GoogleGenerativeAI(API_KEYS[currentApiKeyIndex]);

// Track rate limits for each API key
const apiKeyStatus = new Map<string, {
  lastUsed: number;
  failureCount: number;
  cooldownUntil: number;
}>();

// Initialize status for all API keys
API_KEYS.forEach(key => {
  apiKeyStatus.set(key, {
    lastUsed: 0,
    failureCount: 0,
    cooldownUntil: 0
  });
});

const RATE_LIMIT_COOLDOWN = 60000; // 1 minute cooldown
const MAX_FAILURES = 3; // Max consecutive failures before cooling down

const getNextAvailableApiKey = (): string | null => {
  const now = Date.now();
  
  // Try to find a key that's not in cooldown
  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[i];
    const status = apiKeyStatus.get(key);
    
    if (!status) continue;
    
    // Skip keys in cooldown
    if (now < status.cooldownUntil) continue;
    
    // Reset failure count if it's been more than the cooldown period
    if (now - status.lastUsed > RATE_LIMIT_COOLDOWN) {
      status.failureCount = 0;
    }
    
    // Use this key if it hasn't failed too many times
    if (status.failureCount < MAX_FAILURES) {
      return key;
    }
  }
  
  return null; // All keys are in cooldown
};

const markApiKeyFailure = (key: string) => {
  const status = apiKeyStatus.get(key);
  if (!status) return;
  
  status.failureCount++;
  status.lastUsed = Date.now();
  
  // Put key in cooldown if it's failed too many times
  if (status.failureCount >= MAX_FAILURES) {
    status.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN;
    console.log(`API key ${key} put in cooldown until ${new Date(status.cooldownUntil).toISOString()}`);
  }
  
  apiKeyStatus.set(key, status);
};

const resetApiKeyStatus = (key: string) => {
  apiKeyStatus.set(key, {
    lastUsed: Date.now(),
    failureCount: 0,
    cooldownUntil: 0
  });
};

// Update getNextApiKey to use the new rotation mechanism
const getNextApiKey = (): string => {
  const nextKey = getNextAvailableApiKey();
  
  if (!nextKey) {
    // All keys are in cooldown, wait for the shortest cooldown
    const minCooldown = Math.min(...Array.from(apiKeyStatus.values()).map(s => s.cooldownUntil));
    const waitTime = Math.max(0, minCooldown - Date.now());
    
    if (waitTime > 0) {
      console.log(`All API keys are in cooldown. Waiting ${waitTime}ms...`);
      return API_KEYS[0]; // Return first key, it will fail but that's okay
    }
    
    // Reset all keys if all are in cooldown
    API_KEYS.forEach(key => resetApiKeyStatus(key));
  }
  
  return nextKey || API_KEYS[0];
};

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
};

const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash",
  generationConfig,
});

// Map file extensions to MIME types
const mimeTypes = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/jpeg',
  '.tiff': 'image/jpeg',
  '.webp': 'image/jpeg',
};

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

async function fileToGenerativePart(fileInput: string | File, originalFileName?: string): Promise<any> {
  try {
    let mimeType: string;
    let data: Uint8Array;

    if (fileInput instanceof File) {
      // Handle File object
      mimeType = fileInput.type;
      data = new Uint8Array(await fileInput.arrayBuffer());
    } else if (typeof fileInput === 'string') {
      // Handle URL string
      const response = await fetch(fileInput);
      const blob = await response.blob();
      mimeType = blob.type;
      data = new Uint8Array(await blob.arrayBuffer());
    } else {
      throw new Error('Invalid file input type');
    }

    // Validate mime type
    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
      console.warn('Mime type not explicitly supported:', mimeType);
      // Instead of throwing error, try to infer from extension
      const extension = (originalFileName || fileInput instanceof File ? fileInput.name : fileInput)
        .split('.')
        .pop()
        ?.toLowerCase();
      
      if (extension) {
        switch (extension) {
          case 'jpg':
          case 'jpeg':
            mimeType = 'image/jpeg';
            break;
          case 'png':
            mimeType = 'image/png';
            break;
          case 'pdf':
            mimeType = 'application/pdf';
            break;
          default:
            throw new Error(`Unsupported file type: ${extension}`);
        }
      }
    }

    // Convert to base64
    const base64 = Buffer.from(data).toString('base64');
    
    return {
      inlineData: {
        data: base64,
        mimeType
      }
    };
  } catch (error) {
    console.error('Error processing file:', error);
    throw error;
  }
}

// Types and Interfaces
interface ArrayConfig {
  fields?: {
    id: string;
    name: string;
    type: string;
  }[];
}

interface Field {
  id: string;
  name: string;
  type: string;
  arrayConfig?: ArrayConfig;
  required?: boolean;
}

interface Document {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  fields?: Field[];
}

interface ExtractionResult {
  [key: string]: any;
}

interface ConversionResponse {
  success: boolean;
  message: string;
  image_base64?: string;
  mime_type?: string;
  width?: number;
  height?: number;
  processed_at?: string;
}

interface ExtractedField {
  name: string;
  value: any;
  confidence?: number;
}

interface ExtractionChoice {
  message: {
    content: string;
  };
}

interface ExtractionAPIResponse {
  choices: ExtractionChoice[];
}

interface ValidationError {
  field: string;
  error: string;
}

// Constants
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds
const SUPPORTED_IMAGE_TYPES = ['jpg', 'png', 'tiff', 'bmp', 'webp', 'jpeg']

// Utility Functions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getRetryDelay = (attempt: number) => {
  const exponentialDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
  return Math.min(exponentialDelay, MAX_RETRY_DELAY);
};

const isRetryableError = (error: any) => {
  if (error?.message?.includes('503')) return true;
  if (error?.message?.includes('overloaded')) return true;
  if (error?.message?.includes('rate limit')) return true;
  return false;
};

const isImageFile = (filepath: string): boolean => {
  const extension = filepath.split('.').pop()?.toLowerCase();
  return extension === 'jpg' || extension === 'jpeg' || SUPPORTED_IMAGE_TYPES.includes(extension || '');
};

const formatExtractedValue = (value: any, fieldType: string): any => {
  if (value === null || value === undefined) return null;

  switch (fieldType) {
    case 'date':
      try {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
      } catch {
        return null;
      }
    
    case 'number':
      const num = typeof value === 'string' ? 
        parseFloat(value.replace(/[^\d.-]/g, '')) : 
        parseFloat(String(value));
      return isNaN(num) ? null : num;
    
    case 'array':
      return Array.isArray(value) ? value : [];
    
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lowered = value.toLowerCase().trim();
        if (['true', 'yes', '1'].includes(lowered)) return true;
        if (['false', 'no', '0'].includes(lowered)) return false;
      }
      return null;
    
    default:
      return String(value).trim();
  }
};

const parseExtractionResponse = (output: string): Record<string, any> => {
  try {
    // First try to parse as JSON
    if (typeof output !== 'string') {
      return output; // If it's already an object, return it
    }

    // Look for JSON in the string
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // If not JSON, try to parse line by line
    const parsedData: Record<string, any> = {};
    const lines = output.split('\n');
    
    lines.forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        if (value) {
          // Try to parse as JSON if it looks like an array or object
          if ((value.startsWith('[') && value.endsWith(']')) || 
              (value.startsWith('{') && value.endsWith('}'))) {
            try {
              parsedData[key.trim()] = JSON.parse(value);
            } catch {
              parsedData[key.trim()] = value;
            }
          } else {
            // Try to convert to appropriate type
            const trimmedValue = value.trim();
            if (trimmedValue === 'true') {
              parsedData[key.trim()] = true;
            } else if (trimmedValue === 'false') {
              parsedData[key.trim()] = false;
            } else if (!isNaN(Number(trimmedValue))) {
              parsedData[key.trim()] = Number(trimmedValue);
            } else {
              parsedData[key.trim()] = trimmedValue;
            }
          }
        }
      }
    });
    
    return parsedData;
  } catch (error) {
    console.error('Error parsing extraction response:', error);
    throw new Error('Failed to parse extraction response');
  }
};

const validateExtractedData = (
  extractedData: ExtractionResult,
  fields: Field[]
): boolean => {
  try {
    for (const field of fields) {
      const value = extractedData[field.name];
      if (value === null) continue;

      switch (field.type) {
        case 'date':
          if (value && isNaN(Date.parse(String(value)))) {
            console.warn(`Invalid date value for field ${field.name}:`, value);
            return false;
          }
          break;

        case 'number':
          if (value && isNaN(Number(value))) {
            console.warn(`Invalid number value for field ${field.name}:`, value);
            return false;
          }
          break;

        case 'array':
          if (value && !Array.isArray(value)) {
            console.warn(`Invalid array value for field ${field.name}:`, value);
            return false;
          }
          if (field.arrayConfig?.fields && Array.isArray(value)) {
            for (const item of value) {
              for (const subField of field.arrayConfig.fields) {
                const subValue = item[subField.name];
                if (subValue !== undefined) {
                  const formattedValue = formatExtractedValue(subValue, subField.type);
                  if (formattedValue === null && subValue !== null) {
                    console.warn(`Invalid array item value for field ${field.name}.${subField.name}:`, subValue);
                    return false;
                  }
                }
              }
            }
          }
          break;
      }
    }
    return true;
  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
};


const BANKS = [
  /African Banking Corp/i,
  /Bank of Africa Kenya/i,
  /Bank of India/i,
  /Bank of Baroda/i,
  /Barclays Bank of Kenya/i,
  /ABSA/i,
  /CfC Stanbic Bank/i,
  /Chase Bank/i,
  /Citibank N.A./i,
  /Commercial Bank of Africa/i,
  /Consolidated Bank of Kenya/i,
  /Co-operative Bank of Kenya/i,
  /Credit Bank/i,
  /Development Bank/i,
  /Diamond Trust Bank/i,
  /Dubai Bank/i,
  /Ecobank/i,
  /Equatorial Commercial Bank/i,
  /Equity Bank/i,
  /Family Bank/i,
  /Faulu Bank/i,
  /Fidelity Commercial Bank/i,
  /Fina Bank/i,
  /First Community Bank/i,
  /Giro Commercial Bank/i,
  /Guardian Bank/i,
  /Gulf African Bank/i,
  /Habib Bank A.G. Zurich/i,
  /Habib Bank/i,
  /Housing Finance Company of Kenya/i,
  /Imperial Bank/i,
  /I & M Bank/i,
  /Jamii Bora Bank/i,
  /K-Rep Bank/i,
  /Kenya Commercial Bank/i,
  /Kenya Women Microfinance Bank/i,
  /Middle East Bank/i,
  /National Bank of Kenya/i,
  /NIC Bank/i,
  /Oriental Bank/i,
  /Paramount Universal Bank/i,
  /Prime Bank/i,
  /Postbank/i,
  /Standard Chartered Bank/i,
  /Transnational Bank/i,
  /UBA Kenya Bank/i,
  /Victoria Commercial Bank/i
];

const MPESA_PATTERNS = [
  /M-PESA/i,
  /MPESA/i,
  /Pay Bill/i,
  /Transaction ID/i,
  /REF/i,
  /Safaricom/i,
  /KCB-MPESA/i,
  /COOP-MPESA/i
];

const BANK_PATTERNS = [
  /bank/i,
  /transfer/i,
  /RTGS/i,
  /EFT/i,
  /transaction ref/i,
  /KCB/i,
  /EQUITY/i,
  /COOPERATIVE/i,
  /STANDARD CHARTERED/i,
  /ABSA/i
];



// Update the performExtraction function
export const performExtraction = async (
  fileUrl: string,
  fields: Field[],
  documentType: string,
  onProgress?: (message: string) => void,
  originalFileName?: string
): Promise<{
  extractedData: ExtractionResult;
  success: boolean;
  message: string;
  validationErrors?: ValidationError[];
  failedImage?: string;
  failedFields?: Field[];
}> => {
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    try {
      onProgress?.(`Attempt ${attempts + 1}/${MAX_ATTEMPTS}: Processing document...`);
      
      const filePart = await fileToGenerativePart(fileUrl, originalFileName);
      const fieldPrompts = formatFieldPrompts(fields);
      const exampleOutput = createExampleOutput(fields);
      
      const prompt = `
        Extract the following information from this ${documentType}:
        ${fieldPrompts}

        Mpesa patterns:${MPESA_PATTERNS.join(', ')}

        Bank Transfer Patterns :${BANK_PATTERNS.join(', ')}

        Identify Logos and Try to determine The bank from Kenyan Banks : ${BANKS.join(', ')}

        Amounts must have commas and remove decimals 

        Note that Payment ode is strictly Mpesa or Bank Transfer

        Strictly check if the amount is written in words for further confirmation(if available) -more accurate
        
        Please return the extracted data in this JSON format:
        ${JSON.stringify(exampleOutput, null, 2)}
        
        Only return the JSON data, no other text.
      `.trim();

      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig,
      });

      const result = await model.generateContent([prompt, filePart]);
      const response = await result.response;
      const text = response.text();
      
      if (!text) {
        throw new Error('No text generated from the model');
      }

      onProgress?.('Parsing extracted data...');
      const extractedData = parseExtractionResponse(text);
      const cleanedData = cleanExtractedData(extractedData, fields);
      
      let mappedData = extractedData.rawData || {};
      
      if (!extractedData.rawData) {
        fields.forEach(field => {
          if (field.type === 'array' && field.isArray && field.arrayConfig?.fields) {
            // Generic array field handling
            const arrayFieldName = field.name;
            let arrayData = extractedData[arrayFieldName] || [];
            
            // If data is not in array format, try to construct array from flat data
            if (!Array.isArray(arrayData)) {
              const constructedArray = [];
              const maxItems = field.arrayConfig.maxItems || 1;
              
              // First, try to find data in nested format
              if (typeof extractedData[arrayFieldName] === 'object') {
                const itemData = {};
                let hasData = false;
                
                field.arrayConfig.fields.forEach(subField => {
                  const value = extractedData[arrayFieldName][subField.name.trim()];
                  if (value !== undefined) {
                    itemData[subField.name.trim()] = value;
                    hasData = true;
                  }
                });
                
                if (hasData) {
                  constructedArray.push(itemData);
                }
              }
              
              // If no nested data found, try various field naming patterns
              if (constructedArray.length === 0) {
                for (let i = 0; i < maxItems; i++) {
                  const itemData = {};
                  let hasData = false;
                  
                  field.arrayConfig.fields.forEach(subField => {
                    // Try multiple field name patterns
                    const possibleKeys = [
                      // Array index patterns
                      `${arrayFieldName}_${i + 1}_${subField.name.trim()}`,
                      `${arrayFieldName}[${i}].${subField.name.trim()}`,
                      `${arrayFieldName}.${i}.${subField.name.trim()}`,
                      `${arrayFieldName}[${i}][${subField.name.trim()}]`,
                      // Direct field patterns
                      `${subField.name.trim()}`,
                      `${subField.name.toLowerCase().trim()}`,
                      // Nested object patterns
                      `${arrayFieldName}.${subField.name.trim()}`,
                      `${arrayFieldName}_${subField.name.trim()}`
                    ];
                    
                    // Try to find value in extractedData using possible keys
                    const value = possibleKeys.reduce((val, key) => {
                      if (val !== undefined) return val;
                      
                      // Check direct match
                      if (extractedData[key] !== undefined) return extractedData[key];
                      
                      // Check nested objects
                      const parts = key.split('.');
                      let current = extractedData;
                      for (const part of parts) {
                        if (current === undefined || current === null) return undefined;
                        current = current[part];
                      }
                      return current;
                    }, undefined);
                    
                    if (value !== undefined) {
                      itemData[subField.name.trim()] = value;
                      hasData = true;
                    }
                  });
                  
                  if (hasData) {
                    constructedArray.push(itemData);
                  }
                }
              }
              
              // If we found any data in our constructed array, use it
              if (constructedArray.length > 0) {
                arrayData = constructedArray;
              }
            }
            
            // Clean up array data - remove empty or undefined values
            arrayData = arrayData.filter(item => {
              if (!item || typeof item !== 'object') return false;
              return Object.values(item).some(val => val !== undefined && val !== null && val !== '');
            });
            
            // Only add the array if it contains data
            if (arrayData.length > 0) {
              mappedData[arrayFieldName] = arrayData;
            }
          } else {
            // Handle regular fields
            const fieldKeys = [
              field.name.trim(),
              field.name.toLowerCase().trim(),
              field.name.replace(/[_\s]/g, ''),
              field.name.replace(/[_\s]/g, '.')
            ];
            
            const value = fieldKeys.reduce((val, key) => {
              if (val !== undefined) return val;
              
              // Check direct match
              if (extractedData[key] !== undefined) return extractedData[key];
              
              // Check nested objects
              const parts = key.split('.');
              let current = extractedData;
              for (const part of parts) {
                if (current === undefined || current === null) return undefined;
                current = current[part];
              }
              return current;
            }, undefined);
            
            if (value !== undefined) {
              mappedData[field.name] = value;
            }
          }
        });
      }

      let validationErrors: ValidationError[] = [];
      fields.forEach(field => {
        const value = mappedData[field.name];
        const validation = validateField(value, field);
        if (!validation.isValid) {
          validationErrors.push({
            field: field.name,
            error: validation.error
          });
        }
      });

      // Even if we have validation errors, return the data for manual review
      return {
        extractedData: mappedData,
        success: true,
        message: validationErrors.length > 0 
          ? 'Data extracted with some validation issues. Please review and correct if needed.'
          : 'Data extracted successfully',
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
        failedImage: fileUrl,  // Always include the image URL
        failedFields: fields   // Always include the fields
      };

    } catch (error) {
      attempts++;
      console.error(`Extraction attempt ${attempts} failed:`, error);
      
      // Check for rate limit error
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        markApiKeyFailure(API_KEYS[currentApiKeyIndex]);
      }
      
      if (attempts < MAX_ATTEMPTS) {
        onProgress?.(`Extraction failed. Trying with backup API key (Attempt ${attempts + 1}/${MAX_ATTEMPTS})...`);
        const nextKey = getNextApiKey();
        currentApiKeyIndex = API_KEYS.indexOf(nextKey);
        genAI = new GoogleGenerativeAI(nextKey);
        
        // Add a small delay before retrying
        await delay(1000);
      } else {
        // Return empty data but include image and fields for manual entry
        return {
          extractedData: {},
          success: false,
          message: `Extraction failed after ${MAX_ATTEMPTS} attempts. Please enter the data manually.`,
          failedImage: fileUrl,
          failedFields: fields
        };
      }
    }
  }

  // Return empty data but include image and fields for manual entry
  return {
    extractedData: {},
    success: false,
    message: 'Extraction failed after all attempts. Please enter the data manually.',
    failedImage: fileUrl,
    failedFields: fields
  };
};


export const performBatchExtraction = async (
  documents: BatchDocumentInput[],
  fields: Field[],
  documentType: string,
  onProgress?: (message: string) => void
): Promise<{
  extractedData: Record<string, ExtractionResult>;
  success: boolean;
  message: string;
}> => {
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    try {
      onProgress?.(`Attempt ${attempts + 1}/${MAX_ATTEMPTS}: Processing ${documents.length} documents...`);

      // Process all documents in parallel
      const documentParts = await Promise.all(
        documents.map(doc => fileToGenerativePart(doc.url))
      );

      // Create a combined prompt for all documents
      const fieldPrompts = formatFieldPrompts(fields);
      const exampleOutput = createExampleOutput(fields);

      const prompt = `
        Extract information from multiple documents. For each document, identify the type and extract:
        ${fieldPrompts}

        Mpesa patterns: ${MPESA_PATTERNS.join(', ')}
        Bank Transfer Patterns: ${BANK_PATTERNS.join(', ')}
        Identify Logos and Try to determine The bank from Kenyan Banks: ${BANKS.join(', ')}

        Amounts must have commas and remove decimals 
        Payment mode should be strictly "Mpesa" or "Bank Transfer"
        Check amount written in words for confirmation (if available)
        Date in format of DD/MM/YYYY

        Process the following documents:
        ${documents.map((doc, i) => `Document ${i + 1}: ${doc.label} (${doc.type})`).join('\n')}

        Return the extracted data as a JSON object with document types as keys:
        {
          "${documents[0].type}": ${JSON.stringify(exampleOutput, null, 2)},
          "${documents[1].type}": ${JSON.stringify(exampleOutput, null, 2)},
          ...
        }

        Only return the JSON data, no other text.
      `.trim();

      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig,
      });

      // Send all documents in a single request
      const result = await model.generateContent([prompt, ...documentParts]);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('No text generated from the model');
      }

      onProgress?.('Parsing extracted data...');
      const extractedData = parseExtractionResponse(text);

      // Validate and clean data for each document
      const processedResults: Record<string, ExtractionResult> = {};

      for (const doc of documents) {
        const docData = extractedData[doc.type] || {};
        const cleanedData = cleanExtractedData(docData, fields);

        let validationErrors: ValidationError[] = [];
        fields.forEach(field => {
          const value = cleanedData[field.name];
          const validation = validateField(value, field);
          if (!validation.isValid) {
            validationErrors.push({
              field: field.name,
              error: validation.error
            });
          }
        });

        processedResults[doc.type] = {
          extractedData: cleanedData,
          success: true,
          message: validationErrors.length > 0
            ? 'Data extracted with validation issues'
            : 'Data extracted successfully',
          validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
          documentUrl: doc.url
        };
      }

      return {
        extractedData: processedResults,
        success: true,
        message: 'Batch extraction completed successfully'
      };

    } catch (error) {
      attempts++;
      console.error(`Batch extraction attempt ${attempts} failed:`, error);

      if (error.message?.includes('429') || error.message?.includes('quota')) {
        markApiKeyFailure(API_KEYS[currentApiKeyIndex]);
        const nextKey = getNextApiKey();
        currentApiKeyIndex = API_KEYS.indexOf(nextKey);
        genAI = new GoogleGenerativeAI(nextKey);
      }

      if (attempts < MAX_ATTEMPTS) {
        onProgress?.(`Extraction failed. Retrying with backup API key (Attempt ${attempts + 1}/${MAX_ATTEMPTS})...`);
        await delay(1000);
        continue;
      }

      return {
        extractedData: {},
        success: false,
        message: `Batch extraction failed after ${MAX_ATTEMPTS} attempts`
      };
    }
  }

  return {
    extractedData: {},
    success: false,
    message: 'Batch extraction failed after all attempts'
  };
};

export const saveExtractedData = async (
  uploadId: string,
  documentId: string,
  extractedData: ExtractionResult
): Promise<{ upload: any; document: any }> => {
  try {
    const [uploadUpdate, documentUpdate] = await Promise.all([
      // Update upload record
      supabase
        .from('acc_portal_kyc_uploads')
        .update({ 
          extracted_details: extractedData,
          extraction_date: new Date().toISOString(),
          extraction_status: 'success',
          fields_extracted: true
        })
        .eq('id', uploadId)
        .select()
        .single(),

      // Update document record
      supabase
        .from('acc_portal_kyc')
        .update({ 
          extracted_fields: extractedData,
          extraction_date: new Date().toISOString()
        })
        .eq('id', documentId)
        .select()
        .single()
    ]);

    if (uploadUpdate.error) throw uploadUpdate.error;
    if (documentUpdate.error) throw documentUpdate.error;

    return {
      upload: uploadUpdate.data,
      document: documentUpdate.data
    };
  } catch (error) {
    console.error('Error saving extracted data:', error);
    throw new Error('Failed to save extracted data');
  }
};

export const retryExtraction = async (
  fileUrl: string,
  fields: Field[],
  documentType: string,
  maxRetries: number = MAX_RETRIES,
  onProgress?: (message: string) => void,
  originalFileName?: string
): Promise<{ extractedData: ExtractionResult; success: boolean; message: string; validationErrors?: ValidationError[] }> => {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxRetries) {
    try {
      // onProgress?.(`Attempt ${attempt + 1} of ${maxRetries}...`);
      const result = await performExtraction(fileUrl, fields, documentType, onProgress, originalFileName);
      
      if (result.success) {
        return result;
      }
      
      throw new Error('Extraction failed');
    } catch (error) {
      lastError = error as Error;
      attempt++;
      
      if (attempt < maxRetries) {
        const backoffTime = Math.pow(2, attempt - 1) * 1000;
        onProgress?.(`Retrying in ${backoffTime/1000} seconds...`);
        await delay(backoffTime);
      }
    }
  }

  throw new Error(`Extraction failed after ${maxRetries} attempts: ${lastError?.message}`);
};

export const getSignedUrl = async (filepath: string): Promise<string> => {
  try {
    const { data, error } = await supabase
      .storage
      .from('kyc-documents')
      .createSignedUrl(filepath, 60);

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw new Error('Failed to generate document URL');
  }
};

const extractionUtils = {
  performExtraction,
  saveExtractedData,
  retryExtraction,
  getSignedUrl,
  isImageFile,
  validateExtractedData,
  formatExtractedValue,
  parseExtractionResponse,
};

export default extractionUtils;

export const isExtractionError = (error: unknown): error is Error => {
  return error instanceof Error;
};

export const getErrorMessage = (error: unknown): string => {
  if (isExtractionError(error)) {
    return error.message;
  }
  return 'An unknown error occurred';
};

const validateDateField = (value: string): boolean => {
  // Common date formats
  const dateFormats = [
    'YYYY-MM-DD',    // ISO format
    'DD/MM/YYYY',    // UK/European format
    'MM/DD/YYYY',    // US format
    'DD-MM-YYYY',    // Dash separated
    'DD.MM.YYYY',    // Dot separated
    'YYYY/MM/DD',    // ISO with slashes
  ];

  // Try to parse the date using each format
  for (const format of dateFormats) {
    const date = dayjs(value, format, true);
    if (date.isValid()) {
      return true;
    }
  }

  return false;
}

const transformDateToISO = (value: string): string => {
  const dateFormats = [
    'YYYY-MM-DD',
    'DD/MM/YYYY',
    'MM/DD/YYYY',
    'DD-MM-YYYY',
    'DD.MM.YYYY',
    'YYYY/MM/DD',
  ];

  for (const format of dateFormats) {
    const date = dayjs(value, format, true);
    if (date.isValid()) {
      return date.format('YYYY-MM-DD');
    }
  }

  return value;
}

export const validateField = (
  value: any,
  field: Field
): { isValid: boolean; error?: string } => {
  // Allow empty non-required fields
  if (!value && !field.required) {
    return { isValid: true };
  }

  // Required field check
  if (!value && field.required) {
    return {
      isValid: false,
      error: `${field.name} is required`
    };
  }

  try {
    switch (field.type) {
      case 'date':
        if (value && !validateDateField(value)) {
          return {
            isValid: false,
            error: `Invalid date format for ${field.name}`
          };
        }
        break;

      case 'number':
        if (value && isNaN(Number(value))) {
          return {
            isValid: false,
            error: `Invalid number format for ${field.name}`
          };
        }
        break;

      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return {
            isValid: false,
            error: `Invalid email format for ${field.name}`
          };
        }
        break;

      case 'phone':
        if (value && !/^\+?[\d\s-]{10,}$/.test(value)) {
          return {
            isValid: false,
            error: `Invalid phone format for ${field.name}`
          };
        }
        break;
    }

    return { isValid: true };
  } catch (error) {
    console.error(`Validation error for field ${field.name}:`, error);
    return {
      isValid: false,
      error: `Validation error for ${field.name}`
    };
  }
};

export const transformFieldValue = (field: Field, value: any): any => {
  if (!value) return value;

  switch (field.type) {
    case 'date':
      return transformDateToISO(value);
    case 'number':
      return Number(value);
    default:
      return value;
  }
}

export const cleanExtractedData = (
  data: ExtractionResult,
  fields: Field[]
): ExtractionResult => {
  const cleanedData: ExtractionResult = {};
  
  fields.forEach(field => {
    const value = data[field.name];
    if (value === undefined) {
      cleanedData[field.name] = null;
      return;
    }

    if (field.type === 'array' && field.arrayConfig?.fields) {
      if (!Array.isArray(value)) {
        cleanedData[field.name] = [];
        return;
      }

      cleanedData[field.name] = value.map(item => {
        const cleanedItem = {};
        field.arrayConfig?.fields?.forEach(subField => {
          (cleanedItem as Record<string, unknown>)[subField.name] = transformFieldValue(subField, (item as Record<string, unknown>)[subField.name]);
        });
        return cleanedItem;
      });
    } else {
      cleanedData[field.name] = transformFieldValue(field, value);
    }
  });

  return cleanedData;
};

export const isValidExtractionResponse = (
  response: any
): response is ExtractionAPIResponse => {
  return (
    response &&
    Array.isArray(response.choices) &&
    response.choices.length > 0 &&
    response.choices[0].message &&
    typeof response.choices[0].message.content === 'string'
  );
};

export const formatFieldPrompts = (fields: Field[]): string => {
  if (!Array.isArray(fields)) {
    console.warn('Invalid fields parameter:', fields);
    return '';
  }

  return fields.map(field => {
    let prompt = `- ${field.name}`;
    
    if (field.type === 'array' && field.arrayConfig?.fields) {
      prompt += ' (multiple entries possible) with fields:';
      field.arrayConfig.fields.forEach(subField => {
        prompt += `\n  * ${subField.name}`;
      });
    } else if (field.type === 'date') {
      prompt += ' (in DD/MM/YYYY format)';
    }
    
    return prompt;
  }).join('\n');
};

export const createExampleOutput = (fields: Field[]): Record<string, any> => {
  return fields.reduce((acc, field) => {
    if (field.type === 'array' && field.arrayConfig?.fields) {
      acc[field.name] = [{
        ...field.arrayConfig.fields.reduce<Record<string, string>>((subAcc, subField) => {
          subAcc[subField.name] = `example_${subField.type}`;
          return subAcc;
        }, {})
      }];
    } else {
      acc[field.name] = `example_${field.type}`;
    }
    return acc;
  }, {} as Record<string, any>);
};

export const handleExtractionAPIError = (error: unknown): never => {
  let errorMessage = 'Failed to extract document details';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  console.error('Extraction API error:', error);
  throw new Error(errorMessage);
};

import { CompanyPayrollRecord } from '@/app/payroll/types'

export interface ExtractionResult {
    companyName: string
    taxType: string
    amount: string | null
    paymentMode: string | null
    paymentDate: string | null
    documentPath: string | null
    status: 'processing' | 'success' | 'error'
    error?: string
}

export const TAX_TYPES = [
    { id: 'paye', label: 'PAYE', color: 'bg-blue-600' },
    { id: 'housing_levy', label: 'Hs. Levy', color: 'bg-green-600' },
    { id: 'nita', label: 'NITA', color: 'bg-purple-600' },
    { id: 'shif', label: 'SHIF', color: 'bg-orange-600' },
    { id: 'nssf', label: 'NSSF', color: 'bg-red-600' },
]

export function formatAmount(amount: number | string | null): string {
    if (!amount) return '-'
    
    // Remove any existing commas and handle European format
    const cleanAmount = amount.toString().replace(/,/g, '').replace(/\./g, '')
    
    // Convert to number and format
    const num = parseFloat(cleanAmount) / 100
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
}

export async function extractDocumentData(
    record: CompanyPayrollRecord,
    onProgress?: (result: ExtractionResult) => void
): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = []

    for (const taxType of TAX_TYPES) {
        try {
            // Notify that processing is starting for this tax type
            const progressResult: ExtractionResult = {
                companyName: record.company.company_name,
                taxType: taxType.id,
                amount: null,
                paymentMode: null,
                paymentDate: null,
                documentPath: null,
                status: 'processing'
            }
            onProgress?.(progressResult)
            results.push(progressResult)

            // Get the document path and extracted data
            const documentPath = record.payment_slips_documents[`${taxType.id}_slip`]
            const extractedData = record.payment_slips_extractions?.[`${taxType.id}_slip`]

            if (!documentPath) {
                progressResult.status = 'error'
                progressResult.error = 'Document not found'
                onProgress?.(progressResult)
                continue
            }

            // Update with data from database
            progressResult.amount = extractedData?.amount || null
            progressResult.paymentMode = extractedData?.payment_mode || null
            progressResult.paymentDate = extractedData?.payment_date || null
            progressResult.documentPath = documentPath
            progressResult.status = 'success'

            onProgress?.(progressResult)
        } catch (error) {
            const errorResult: ExtractionResult = {
                companyName: record.company.company_name,
                taxType: taxType.id,
                amount: null,
                paymentMode: null,
                paymentDate: null,
                documentPath: null,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            }
            results.push(errorResult)
            onProgress?.(errorResult)
        }
    }

    return results
}

export async function processAllDocuments(
    records: CompanyPayrollRecord[],
    onProgress: (results: ExtractionResult[]) => void
): Promise<void> {
    const allResults: ExtractionResult[] = []

    for (const record of records) {
        const results = await extractDocumentData(record, (result) => {
            allResults.push(result)
            onProgress([...allResults])
        })
    }
}