import { useState } from 'react';
import { Field, ExtractionResult, ValidationError } from '@/types/extraction';
import { fileToGenerativePart, formatFieldPrompts, createExampleOutput, parseExtractionResponse, cleanExtractedData, validateField, delay } from '@/utils/extraction';
import { apiKeyManager } from '@/app/shared/utils/apiKeys';

interface DocumentExtractorProps {
  fileUrl: string;
  fields: Field[];
  documentType: string;
  onExtracted: (result: {
    extractedData: ExtractionResult;
    success: boolean;
    message: string;
    validationErrors?: ValidationError[];
    failedImage?: string;
    failedFields?: Field[];
  }) => void;
  originalFileName?: string;
}

export const DocumentExtractor = ({
  fileUrl,
  fields,
  documentType,
  onExtracted,
  originalFileName
}: DocumentExtractorProps) => {
  const [progress, setProgress] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const performExtraction = async () => {
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    setIsProcessing(true);

    while (attempts < MAX_ATTEMPTS) {
      try {
        setProgress(`Attempt ${attempts + 1}/${MAX_ATTEMPTS}: Processing document...`);
        
        const filePart = await fileToGenerativePart(fileUrl, originalFileName);
        const fieldPrompts = formatFieldPrompts(fields);
        const exampleOutput = createExampleOutput(fields);
        
        console.log('Extraction configuration:', {
          documentType,
          fields,
          fieldPrompts,
          exampleOutput
        });

        const prompt = `
          Extract the following information from this ${documentType}:
          ${fieldPrompts}
          
          Please return the extracted data in this JSON format:
          ${JSON.stringify(exampleOutput, null, 2)}
          
          Only return the JSON data, no other text.
        `.trim();

        console.log('Extraction prompt:', prompt);

        const model = apiKeyManager.genAI.getGenerativeModel({ 
          model: "gemini-2.0-flash",
          generationConfig,
        });

        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const text = response.text();
        
        console.log('Raw extraction response:', text);
        
        if (!text) {
          throw new Error('No text generated from the model');
        }

        setProgress('Parsing extracted data...');
        const extractedData = parseExtractionResponse(text);
        console.log('Parsed extraction data:', extractedData);
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
                      const possibleKeys = [
                        `${arrayFieldName}_${i + 1}_${subField.name.trim()}`,
                        `${arrayFieldName}[${i}].${subField.name.trim()}`,
                        `${arrayFieldName}.${i}.${subField.name.trim()}`,
                        `${arrayFieldName}[${i}][${subField.name.trim()}]`,
                        `${subField.name.trim()}`,
                        `${subField.name.toLowerCase().trim()}`,
                        `${arrayFieldName}.${subField.name.trim()}`,
                        `${arrayFieldName}_${subField.name.trim()}`
                      ];
                      
                      const value = possibleKeys.reduce((val, key) => {
                        if (val !== undefined) return val;
                        if (extractedData[key] !== undefined) return extractedData[key];
                        
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
                
                if (constructedArray.length > 0) {
                  arrayData = constructedArray;
                }
              }
              
              arrayData = arrayData.filter(item => {
                if (!item || typeof item !== 'object') return false;
                return Object.values(item).some(val => val !== undefined && val !== null && val !== '');
              });
              
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
                if (extractedData[key] !== undefined) return extractedData[key];
                
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

        setIsProcessing(false);
        onExtracted({
          extractedData: mappedData,
          success: true,
          message: validationErrors.length > 0 
            ? 'Data extracted with some validation issues. Please review and correct if needed.'
            : 'Data extracted successfully',
          validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
          failedImage: fileUrl,
          failedFields: fields
        });
        return;

      } catch (error) {
        attempts++;
        console.error(`Extraction attempt ${attempts} failed:`, error);
        
        if (error.message?.includes('429') || error.message?.includes('quota')) {
          apiKeyManager.markApiKeyFailure(apiKeyManager.currentApiKey);
        }
        
        if (attempts < MAX_ATTEMPTS) {
          setProgress(`Extraction failed. Trying with backup API key (Attempt ${attempts + 1}/${MAX_ATTEMPTS})...`);
          apiKeyManager.getNextApiKey();
          
          await delay(1000);
        } else {
          setIsProcessing(false);
          onExtracted({
            extractedData: {},
            success: false,
            message: `Extraction failed after ${MAX_ATTEMPTS} attempts. Please enter the data manually.`,
            failedImage: fileUrl,
            failedFields: fields
          });
          return;
        }
      }
    }

    setIsProcessing(false);
    onExtracted({
      extractedData: {},
      success: false,
      message: 'Extraction failed after all attempts. Please enter the data manually.',
      failedImage: fileUrl,
      failedFields: fields
    });
  };

  return (
    <div className="space-y-4">
      {isProcessing && (
        <div className="text-sm text-gray-600">
          {progress}
        </div>
      )}
    </div>
  );
};
