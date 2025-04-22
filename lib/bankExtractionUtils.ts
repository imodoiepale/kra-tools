// @ts-nocheck
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import * as pdfjsLib from 'pdfjs-dist';
// import * as qpdf from 'node-qpdf';
import { API_KEYS } from './apiKeys';
// import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PDFDocument } from 'pdf-lib';

// Constants
const EMBEDDING_MODEL = "gemini-embedding-exp-03-07";
const EXTRACTION_MODEL = "gemini-2.0-flash";
const RATE_LIMIT_COOLDOWN = 60000; // 1 minute cooldown
const MAX_FAILURES = 5; // Max consecutive failures before cooling down

// Initialize the Gemini API with key rotation
let currentApiKeyIndex = 0;
let genAI = new GoogleGenerativeAI(API_KEYS[currentApiKeyIndex]);

// Track rate limits for each API key
const apiKeyStatus = new Map();
API_KEYS.forEach(key => {
  apiKeyStatus.set(key, {
    lastUsed: 0,
    failureCount: 0,
    cooldownUntil: 0
  });
});

// API key management functions
const getNextApiKey = () => {
  const now = Date.now();

  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[i];
    const status = apiKeyStatus.get(key);

    if (!status) continue;
    if (now < status.cooldownUntil) continue;
    if (now - status.lastUsed > RATE_LIMIT_COOLDOWN) {
      status.failureCount = 0;
    }

    if (status.failureCount < MAX_FAILURES) {
      currentApiKeyIndex = API_KEYS.indexOf(key);
      genAI = new GoogleGenerativeAI(key);
      return key;
    }
  }

  // Reset all keys if all are in cooldown
  API_KEYS.forEach(key => {
    apiKeyStatus.set(key, {
      lastUsed: now,
      failureCount: 0,
      cooldownUntil: 0
    });
  });

  currentApiKeyIndex = 0;
  genAI = new GoogleGenerativeAI(API_KEYS[0]);
  return API_KEYS[0];
};

const markApiKeyFailure = (key) => {
  const status = apiKeyStatus.get(key);
  if (!status) return;

  status.failureCount++;
  status.lastUsed = Date.now();

  if (status.failureCount >= MAX_FAILURES) {
    status.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN;
    console.log(`API key put in cooldown until ${new Date(status.cooldownUntil).toLocaleString()}`);
  }

  apiKeyStatus.set(key, status);
};

const resetApiKeyStatus = (key) => {
  apiKeyStatus.set(key, {
    lastUsed: Date.now(),
    failureCount: 0,
    cooldownUntil: 0
  });
};

// Delay helper function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to normalize currency codes
const normalizeCurrencyCode = (code) => {
  if (!code) return 'USD';

  const upperCode = code.toUpperCase().trim();

  const currencyMap = {
    'EURO': 'EUR',
    'EUROS': 'EUR',
    'US DOLLAR': 'USD',
    'US DOLLARS': 'USD',
    'USDOLLAR': 'USD',
    'POUND': 'GBP',
    'POUNDS': 'GBP',
    'STERLING': 'GBP',
    'KENYA SHILLING': 'KES',
    'KENYA SHILLINGS': 'KES',
    'KENYAN SHILLING': 'KES',
    'KENYAN SHILLINGS': 'KES',
    'KSH': 'KES',
    'K.SH': 'KES',
    'KSHS': 'KES',
    'K.SHS': 'KES',
    'SH': 'KES'
  };

  return currencyMap[upperCode] || upperCode;
};

// Helper function to parse currency amounts
function parseCurrencyAmount(amount) {
  if (!amount) return null;

  // Handle both string and number cases
  const amountStr = typeof amount === 'string' ? amount : amount.toString();
  const cleanedAmount = amountStr.replace(/[^\d.-]/g, '');
  const parsedAmount = parseFloat(cleanedAmount);
  return isNaN(parsedAmount) ? null : parsedAmount;
}

// Dynamic import for canvas in Node.js environment
const getCanvas = async () => {
  if (typeof window === 'undefined') {
    return require('canvas');
  }
  return require('canvas-browserify');
};

// Helper to get PDF page count
async function getPdfPageCount(fileUrl, password = null) {
  try {
    // If fileUrl is a string URL
    if (typeof fileUrl === 'string') {
      if (fileUrl.startsWith('blob:')) {
        // Handle blob URLs by fetching them first
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          password: password,
        });
        const pdf = await loadingTask.promise;
        return { success: true, numPages: pdf.numPages, pdf };
      } else {
        // Regular URL handling
        const loadingTask = pdfjsLib.getDocument({
          url: fileUrl,
          password: password,
        });
        const pdf = await loadingTask.promise;
        return { success: true, numPages: pdf.numPages, pdf };
      }
    }

    // If fileUrl is a File object
    if (fileUrl instanceof File) {
      const arrayBuffer = await fileUrl.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        password: password,
      });
      const pdf = await loadingTask.promise;
      return { success: true, numPages: pdf.numPages, pdf };
    }

    // Default fallback
    return { success: false, error: "Invalid file input type" };
  } catch (error) {
    if (error.name === 'PasswordException') {
      return {
        success: false,
        error: error.message,
        requiresPassword: true,
        passwordNeeded: error.code === 1 // 1 = need password, 2 = wrong password
      };
    }
    console.error('Error getting PDF page count:', error);
    return { success: false, error: error.message };
  }
}

// Extract text from specific PDF pages
async function extractTextFromPdfPages(fileUrl, pageNumbers, password = null) {
  try {
    let pdf;

    // Load PDF based on input type with password if provided
    if (typeof fileUrl === 'string') {
      const canvas = await getCanvas();
      const loadingTask = pdfjsLib.getDocument({
        url: fileUrl,
        password: password,
        canvasFactory: canvas.createCanvas,
      });
      pdf = await loadingTask.promise;
    } else if (fileUrl instanceof File) {
      const arrayBuffer = await fileUrl.arrayBuffer();
      const canvas = await getCanvas();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        password: password,
        canvasFactory: canvas.createCanvas,
      });
      pdf = await loadingTask.promise;
    } else {
      throw new Error('Invalid file input type');
    }

    // Extract text from each requested page
    const textByPage = {};

    for (const pageNum of pageNumbers) {
      // Handle special case for last page
      const actualPageNum = pageNum === -1 ? pdf.numPages : pageNum;

      if (actualPageNum < 1 || actualPageNum > pdf.numPages) {
        continue;
      }

      const page = await pdf.getPage(actualPageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');

      textByPage[actualPageNum] = pageText;
    }

    return { success: true, textByPage };
  } catch (error) {
    if (error.name === 'PasswordException') {
      return {
        success: false,
        error: error.message,
        requiresPassword: true,
        passwordNeeded: error.code === 1 // 1 = need password, 2 = wrong password
      };
    }
    console.error('Error extracting text from PDF:', error);
    return { success: false, error: error.message };
  }
}

// Convert file to part format for Gemini API
async function fileToGenerativePart(fileInput, originalFileName) {
  try {
    let mimeType;
    let data;

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
    const supportedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!supportedMimeTypes.includes(mimeType)) {
      console.warn('Mime type not explicitly supported:', mimeType);
      // Try to infer from extension
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

// Generate embeddings for text content
async function generateTextEmbeddings(textContent) {
  try {
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts < MAX_ATTEMPTS) {
      try {
        const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

        const result = await embeddingModel.embedContent({
          content: { parts: [{ text: textContent }], role: "user" },
        });

        return result.embedding;
      } catch (error) {
        attempts++;

        if (error.message?.includes('429') || error.message?.includes('quota')) {
          markApiKeyFailure(API_KEYS[currentApiKeyIndex]);
          getNextApiKey();
        }

        if (attempts < MAX_ATTEMPTS) {
          await delay(1000 * attempts);
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

// Create extraction queries for the embedding
function createExtractionQueries() {
  return [
    { field: 'bank_name', query: "What is the name of the bank?" },
    { field: 'account_number', query: "What is the account number?" },
    { field: 'company_name', query: "What is the name of the company or account holder?" },
    { field: 'currency', query: "What currency is used in this statement?" },
    { field: 'statement_period', query: "What is the statement period? Include start and end dates." },
    // { field: 'opening_balance', query: "What is the opening balance of the account?" },
    { field: 'closing_balance', query: "What is the closing balance of the account?" },
    { field: 'monthly_balances', query: "List all monthly balances including month, year, opening and closing balances." }
  ];
}

// Process extraction using embeddings
async function processExtraction(pageTextContent, params, onProgress) {
  try {
    onProgress?.('Generating embeddings for bank statement pages...');

    // Create text embedding for the content
    const pageText = Object.values(pageTextContent).join("\n\n--- PAGE BREAK ---\n\n");
    const contentEmbedding = await generateTextEmbeddings(pageText);

    if (!contentEmbedding) {
      throw new Error('Failed to generate embeddings');
    }

    onProgress?.('Running extraction queries against embeddings...');

    // Create a custom extraction prompt
    const extractionPrompt = `
You are analyzing a bank statement. Extract the following information from the text:

1. Bank Name: The official name of the bank from the document and also identify from Logos available in the document
2. Account Number: The full account number 
3. Company Name: The name of the account holder
4. Currency: The currency code or name used in the statement
5. Statement Period: The exact date range covered in dd/mm/yyyy format always
// 6. Opening Balance: The starting balance
7. Closing Balance: The final balance
6. Monthly Balances: Any balances for specific months mentioned

For the specific month ${params.month}/${params.year}, find exact opening and closing balances if available.

Return your analysis in this JSON format:
{
  "bank_name": "Bank Name",
  "account_number": "Account Number",
  "company_name": "Company Name",
  "currency": "Currency Code",
  "statement_period": "Start Date - End Date",
  // "opening_balance": number,
  "closing_balance": number,
  "monthly_balances": [
    {
      "month": month_number,
      "year": year_number,
      "opening_balance": number,
      "closing_balance": number,
      "statement_page": page_number
    }
  ]
}
`;

    // Use the content and extraction model
    const extractionModel = genAI.getGenerativeModel({
      model: EXTRACTION_MODEL,
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    const result = await extractionModel.generateContent([
      extractionPrompt,
      pageText
    ]);

    const responseText = result.response.text();

    // Parse and validate the extracted data
    onProgress?.('Processing extracted information...');

    let extractedData;
    try {
      // First attempt: Try to find a JSON object in the response
      const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
      
      if (jsonMatch) {
        try {
          // Try to parse the matched JSON
          extractedData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          // If direct parsing fails, try to repair the JSON
          const repairResult = repairJsonString(jsonMatch[0]);
          
          if (repairResult.success) {
            extractedData = repairResult.json;
          } else {
            // Try a more aggressive approach to find any JSON-like structure
            const potentialJson = responseText.replace(/[\s\S]*?(\{[\s\S]*\})[\s\S]*/, '$1');
            const secondRepairResult = repairJsonString(potentialJson);
            
            if (secondRepairResult.success) {
              extractedData = secondRepairResult.json;
            } else {
              // Last resort: try to extract key parts manually
              extractedData = extractFallbackData(responseText, params);
              
              if (!extractedData) {
                throw new Error('No valid JSON structure found in response');
              }
            }
          }
        }
      } else {
        // Try to extract key parts manually if no JSON-like structure is found
        extractedData = extractFallbackData(responseText, params);
        
        if (!extractedData) {
          throw new Error('No JSON found in response');
        }
      }
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      throw new Error('Failed to parse extraction results');
    }

    // Return the normalized data
    return normalizeExtractedData(extractedData, params);

  } catch (error) {
    console.error('Error in extraction process:', error);
    throw error;
  }
}

// Helper function to extract data manually when JSON parsing fails
function extractFallbackData(text, params) {
  try {
    // Create a basic structure
    const fallbackData = {
      bank_name: null,
      account_number: null,
      company_name: null,
      currency: null,
      statement_period: null,
      // opening_balance: null,
      closing_balance: null,
      monthly_balances: []
    };
    
    // Try to extract bank name
    const bankNameMatch = text.match(/[Bb]ank\s*[Nn]ame\s*:?\s*([A-Za-z\s]+(?:Bank|BANK|Ltd|LIMITED|Limited))/);
    if (bankNameMatch) fallbackData.bank_name = bankNameMatch[1].trim();
    
    // Try to extract account number
    const accountMatch = text.match(/[Aa]ccount\s*[Nn]umber\s*:?\s*([0-9\-]+)/);
    if (accountMatch) fallbackData.account_number = accountMatch[1].trim();
    
    // Try to extract company name
    const companyMatch = text.match(/[Cc]ompany\s*[Nn]ame\s*:?\s*([A-Za-z\s]+(?:Ltd|LIMITED|Limited|LLC|Co\.|Inc\.|Corporation)?)/);
    if (companyMatch) fallbackData.company_name = companyMatch[1].trim();
    
    // Try to extract currency
    const currencyMatch = text.match(/[Cc]urrency\s*:?\s*([A-Z]{3}|[A-Za-z\s]+)/);
    if (currencyMatch) fallbackData.currency = currencyMatch[1].trim();
    
    // Try to extract statement period
    const periodMatch = text.match(/[Ss]tatement\s*[Pp]eriod\s*:?\s*([A-Za-z0-9\s\-\/]+)/);
    if (periodMatch) fallbackData.statement_period = periodMatch[1].trim();
    
    // Add the current month to monthly balances
    fallbackData.monthly_balances.push({
      month: params.month,
      year: params.year,
      statement_page: 1,
      highlight_coordinates: null,
      is_verified: false,
      verified_by: null,
      verified_at: null
    });
    
    return fallbackData;
  } catch (error) {
    console.error('Fallback extraction failed:', error);
    return null;
  }
}

// Normalize the extracted data
function normalizeExtractedData(extractedData, params) {
  // Helper function to ensure monthly balances structure
  const processMonthlyBalances = () => {
    const balances = Array.isArray(extractedData.monthly_balances)
      ? extractedData.monthly_balances.map(balance => ({
        month: balance.month,
        year: balance.year,
        // opening_balance: parseCurrencyAmount(balance.opening_balance),
        closing_balance: parseCurrencyAmount(balance.closing_balance),
        statement_page: balance.statement_page || 1,
        highlight_coordinates: null,
        is_verified: false,
        verified_by: null,
        verified_at: null
      }))
      : [];

    // Ensure we have at least the current month in the balances
    const hasCurrentMonth = balances.some(
      balance => balance.month === params.month && balance.year === params.year
    );

    if (!hasCurrentMonth) {
      balances.push({
        month: params.month,
        year: params.year,
        // opening_balance: parseCurrencyAmount(extractedData.opening_balance),
        closing_balance: parseCurrencyAmount(extractedData.closing_balance),
        statement_page: 1,
        highlight_coordinates: null,
        is_verified: false,
        verified_by: null,
        verified_at: null
      });
    }

    return balances;
  };

  return {
    bank_name: extractedData.bank_name || null,
    company_name: extractedData.company_name || null,
    account_number: extractedData.account_number || null,
    currency: extractedData.currency ? normalizeCurrencyCode(extractedData.currency) : null,
    statement_period: extractedData.statement_period || null,
    // opening_balance: parseCurrencyAmount(extractedData.opening_balance),
    closing_balance: parseCurrencyAmount(extractedData.closing_balance),
    monthly_balances: processMonthlyBalances()
  };
}

// Main extraction function
export async function performBankStatementExtraction(
  fileUrl,
  params,
  onProgress = (message) => console.log(message)
) {
  try {
    onProgress('Starting bank statement extraction with embedding approach...');

    // Get total page count (now with password)
    const totalPages = await getPdfPageCount(fileUrl, params.password);

    if (!totalPages || !totalPages.success) {
      const errorMessage = totalPages?.error || 'Failed to get page count';
      onProgress(`Error: ${errorMessage}`);

      // Check if password protected
      if (totalPages?.requiresPassword) {
        return {
          success: false,
          requiresPassword: true,
          passwordNeeded: totalPages.passwordNeeded,
          message: 'This PDF is password protected. Please provide a password.'
        };
      }

      throw new Error(errorMessage);
    }
    
    onProgress(`Detected ${totalPages.numPages} pages in document`);

    // Define pages to process: first and last page
    const pages = [1];
    if (totalPages.numPages > 1) {
      pages.push(totalPages.numPages);
    }

    onProgress(`Extracting text from pages ${pages.join(', ')}...`);
    const pageTextContent = await extractTextFromPdfPages(fileUrl, pages, params.password);
    
    if (!pageTextContent || !pageTextContent.success) {
      const errorMessage = pageTextContent?.error || 'Failed to extract text from PDF';
      onProgress(`Error: ${errorMessage}`);
      
      // Check if password protected
      if (pageTextContent?.requiresPassword) {
        return {
          success: false,
          requiresPassword: true,
          passwordNeeded: pageTextContent.passwordNeeded,
          message: 'This PDF is password protected. Please provide a password.'
        };
      }
      
      throw new Error(errorMessage);
    }

    // Process extraction using the page text
    onProgress('Analyzing document content...');
    const extractedData = await processExtraction(pageTextContent.textByPage, params, onProgress);

    // Add visual data for the document if needed (for highlighting)
    if (pages.length > 0 && pageTextContent) {
      onProgress('Extraction completed successfully');
    }

    return {
      success: true,
      extractedData: extractedData
    };

  } catch (error) {
    console.error('Error in bank statement extraction:', error);

    // Return fallback data structure on error
    return {
      success: false,
      extractedData: {
        bank_name: null,
        company_name: null,
        account_number: null,
        currency: null,
        statement_period: null,
        // opening_balance: null,
        closing_balance: null,
        monthly_balances: [{
          month: params.month,
          year: params.year,
          // opening_balance: null,
          closing_balance: null,
          statement_page: 1,
          highlight_coordinates: null,
          is_verified: false,
          verified_by: null,
          verified_at: null
        }]
      },
      message: `Extraction failed: ${error.message}`
    };
  }
}

// Function to handle multi-month statement submission
async function handleMultiMonthStatement(
  statementData,
  bank,
  cycleMonthYear,
  statementCycleId,
  extractedData,
  documentPaths
) {
  try {
    // Parse the statement period to get all months in the range
    const periodDates = parseStatementPeriod(extractedData.statement_period);

    if (!periodDates) {
      console.warn('Could not parse statement period, using only current month');
      return;
    }

    const { startMonth, startYear, endMonth, endYear } = periodDates;
    const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

    // For each month in the range, create a separate statement entry
    for (const { month, year } of monthsInRange) {
      // Format month/year for cycle lookup
      const monthStr = month.toString().padStart(2, '0');
      const monthYearStr = `${year}-${monthStr}`;

      // Check if a statement cycle exists for this month, create if needed
      let cyclePeriod;

      const { data: existingCycle, error: cycleError } = await supabase
        .from('statement_cycles')
        .select('id')
        .eq('month_year', monthYearStr)
        .single();

      if (cycleError) {
        if (cycleError.code === 'PGRST116') { // No rows found
          // Create new cycle for this month
          const { data: newCycle, error: createError } = await supabase
            .from('statement_cycles')
            .insert({
              month_year: monthYearStr,
              status: 'active',
              created_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (createError) throw createError;
          cyclePeriod = newCycle;
        } else {
          throw cycleError;
        }
      } else {
        cyclePeriod = existingCycle;
      }

      // Check if a statement already exists for this bank/month
      const { data: existingStatement } = await supabase
        .from('acc_cycle_bank_statements')
        .select('id')
        .eq('bank_id', bank.id)
        .eq('statement_month', month)
        .eq('statement_year', year)
        .single();

      if (existingStatement) {
        console.log(`Statement already exists for ${month}/${year}`);
        continue; // Skip if already exists
      }

      // Find specific month data if available
      const monthData = extractedData.monthly_balances.find(
        mb => mb.month === month && mb.year === year
      ) || {
        month,
        year,
        opening_balance: null,
        closing_balance: null,
        statement_page: 1
      };

      // Create new statement for this month
      const newStatementData = {
        bank_id: bank.id,
        company_id: bank.company_id,
        statement_cycle_id: cyclePeriod.id,
        statement_month: month,
        statement_year: year,
        statement_document: documentPaths, // Same document for all periods
        statement_extractions: {
          ...extractedData,
          // Only include relevant month in monthly_balances
          monthly_balances: [monthData]
        },
        has_soft_copy: true,
        has_hard_copy: false,
        validation_status: {
          is_validated: false,
          validation_date: null,
          validated_by: null,
          mismatches: []
        },
        status: {
          status: 'pending_validation',
          assigned_to: null,
          verification_date: null
        }
      };

      // Insert the new statement
      await supabase
        .from('acc_cycle_bank_statements')
        .insert([newStatementData]);

      console.log(`Created statement record for ${month}/${year}`);
    }

    return true;
  } catch (error) {
    console.error('Error handling multi-month statement:', error);
    throw error;
  }
}

export async function processBulkExtraction(batchFiles, params, onProgress) {
  try {
    console.log(`Starting bulk extraction for ${batchFiles.length} files`);
    onProgress(0.1);

    const passwordProtectedFiles = [];
    const allResults = [];

    // Prepare all documents for a combined extraction
    const documentTexts = [];

    // First pass: process all files to extract text and identify password-protected files
    for (const file of batchFiles) {
      try {
        // Check if password protected
        const pageCountResult = await getPdfPageCount(file.fileUrl, file.password);

        if (!pageCountResult.success) {
          if (pageCountResult.requiresPassword) {
            passwordProtectedFiles.push({
              index: file.index,
              fileName: file.originalItem.file.name,
              fileObj: file
            });
            documentTexts.push(`----- DOCUMENT INDEX: ${file.index} -----\nPASSWORD PROTECTED\n----- END OF DOCUMENT ${file.index} -----`);
            continue;
          }
        }

        // Extract text from first and last pages
        const totalPages = pageCountResult.numPages;
        const pagesToProcess = [1];
        if (totalPages > 1) {
          pagesToProcess.push(totalPages);
        }

        const textResult = await extractTextFromPdfPages(file.fileUrl, pagesToProcess, file.password);

        if (!textResult.success) {
          if (textResult.requiresPassword) {
            passwordProtectedFiles.push({
              index: file.index,
              fileName: file.originalItem.file.name,
              fileObj: file
            });
            documentTexts.push(`----- DOCUMENT INDEX: ${file.index} -----\nPASSWORD PROTECTED\n----- END OF DOCUMENT ${file.index} -----`);
            continue;
          }
        }

        // Add document text with clear separation
        documentTexts.push(`
----- DOCUMENT INDEX: ${file.index} -----
FILENAME: ${file.originalItem.file.name}
PAGES EXAMINED: ${pagesToProcess.join(', ')} of ${totalPages}
EXPECTED MONTH/YEAR: ${params.month}/${params.year}

${Object.entries(textResult.textByPage).map(([pageNum, text]) =>
          `--- PAGE ${pageNum} ---\n${text}\n`
        ).join('\n')}

----- END OF DOCUMENT ${file.index} -----
`);
      } catch (error) {
        console.error(`Error processing document ${file.index}:`, error);
        documentTexts.push(`----- DOCUMENT INDEX: ${file.index} -----\nERROR: ${error.message}\n----- END OF DOCUMENT ${file.index} -----`);
      }

      // Update progress
      onProgress(0.1 + 0.4 * ((batchFiles.indexOf(file) + 1) / batchFiles.length));
    }

    // Now do a single API call for all documents
    // (Split into chunks if too large)
    const MAX_CHUNK_SIZE = 5000; // Characters per chunk
    const textChunks = [];
    let currentChunk = "";

    for (const docText of documentTexts) {
      if (currentChunk.length + docText.length > MAX_CHUNK_SIZE) {
        textChunks.push(currentChunk);
        currentChunk = docText;
      } else {
        currentChunk += "\n\n" + docText;
      }
    }

    if (currentChunk.length > 0) {
      textChunks.push(currentChunk);
    }

    const extractionPrompt = `
    You are analyzing multiple bank statements (indexed from 0). For each document:
    1. Identify which document index you're analyzing
    2. Extract these details:
      - Bank Name: The official name of the bank
      - Account Number: The full account number
      - Company Name: The name of the account holder
      - Currency: The currency code used
      - Statement Period: The date range covered in dd/mm/yyyy format strictly 
      - Monthly Balances: Any balances for each month

    FORMAT YOUR RESPONSE as valid, parseable JSON objects, ONE OBJECT PER DOCUMENT:

      {
        "document_index": 0,
        "bank_name": "Example Bank",
        "company_name": "Example Company",
        "account_number": "123456789",
        "currency": "USD",
        "statement_period": "Jan 2024 - Feb 2024",
        "monthly_balances": []
      }

      {
        "document_index": 1,
        "bank_name": "Another Bank",
        ...
      }

      IMPORTANT: Each JSON object must be complete and valid. Do not include any text outside of the JSON objects.
      `;


    // Process each chunk
    for (let i = 0; i < textChunks.length; i++) {
      try {
        // Create an extraction model for this chunk
        const extractionModel = genAI.getGenerativeModel({
          model: EXTRACTION_MODEL,
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 8192,
          },
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
          ],
        });

        // Define extraction prompt if not already defined


        // Use extraction API with the extractionModel
        const extractionResult = await extractionModel.generateContent([extractionPrompt, textChunks[i]]);
        const responseText = extractionResult.response.text();

        // Parse the results
        const chunkResults = [];

        // Look for JSON structures in the response
        // The response should contain multiple JSON objects, one for each document
        const jsonMatches = responseText.match(/\{[\s\S]*?\}/g) || [];

        for (let j = 0; j < jsonMatches.length; j++) {
          try {
            const parsedJson = JSON.parse(jsonMatches[j]);

            // Find which document this result belongs to
            const documentIndex = parsedJson.document_index || parsedJson.index || j;
            const originalIndex = batchFiles.find(f => f.index === parseInt(parsedJson.document_index))?.index || j;

            // Normalize the extracted data
            const normalizedData = normalizeExtractedData(parsedJson, {
              month: batchFiles[0].params?.month,
              year: batchFiles[0].params?.year
            });

            chunkResults.push({
              index: originalIndex,
              success: true,
              extractedData: normalizedData,
              originalItem: batchFiles[originalIndex].originalItem
            });
          } catch (jsonError) {
            console.error('Error parsing JSON for batch item:', jsonError);

            // If parsing fails, add a failed result
            chunkResults.push({
              index: j,
              success: false,
              error: 'Failed to parse extraction results'
            });
          }
        }

        // If we didn't get results for all documents, add failed results
        for (const file of batchFiles) {
          if (!chunkResults.some(result => result.index === file.index)) {
            chunkResults.push({
              index: file.index,
              success: false,
              error: 'No extraction result found for this document'
            });
          }
        }

        allResults.push(...chunkResults);
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
      }

      // Update progress
      onProgress(0.5 + 0.4 * ((i + 1) / textChunks.length));
    }

    // Return results with password-protected files if any
    onProgress(1.0);

    if (passwordProtectedFiles.length > 0) {
      return {
        results: allResults,
        passwordProtectedFiles
      };
    }

    return allResults;
  } catch (error) {
    console.error('Error in bulk document extraction:', error);
    return batchFiles.map(file => ({
      index: file.index,
      success: false,
      error: `Extraction failed: ${error.message}`,
      originalItem: file.originalItem
    }));
  }
}

function parseExtractionResults(responseText, batchFiles) {
  const results = [];

  try {
    console.log("Parsing API response...");

    // Extract each complete JSON object using a better approach
    let potentialJsonMatches = [];

    // First try to find standard JSON objects with the document_index field
    const standardRegex = /\{\s*"document_index"\s*:\s*\d+[\s\S]*?\}/g;
    const standardMatches = responseText.match(standardRegex) || [];
    console.log(`Found ${standardMatches.length} standard JSON objects`);
    potentialJsonMatches.push(...standardMatches);

    // If no standard matches found, try a more general approach
    if (standardMatches.length === 0) {
      const generalRegex = /\{[\s\S]*?\}/g;
      const generalMatches = responseText.match(generalRegex) || [];
      console.log(`Found ${generalMatches.length} general JSON objects`);
      potentialJsonMatches.push(...generalMatches);
    }

    // Process each potential JSON object
    for (let i = 0; i < potentialJsonMatches.length; i++) {
      const jsonStr = potentialJsonMatches[i];

      try {
        // Try to clean up any invalid JSON
        let jsonText = jsonStr.trim();
        
        // Try to parse directly first
        try {
          const parsedObj = JSON.parse(jsonText);
          
          // Skip if no document_index
          if (parsedObj.document_index === undefined) {
            // Try to infer document_index from position
            parsedObj.document_index = i;
          }
          
          // Find matching file
          const matchingFile = batchFiles.find(file => file.index === parseInt(parsedObj.document_index));
          
          if (matchingFile) {
            // Successfully matched and parsed
            results.push({
              index: parsedObj.document_index,
              success: true,
              extractedData: normalizeExtractedData(parsedObj, matchingFile.params || { month: 0, year: 0 }),
              originalItem: matchingFile.originalItem
            });
            continue;
          }
        } catch (directParseError) {
          // Direct parsing failed, try repair
        }
        
        // Try to repair the JSON
        const repairResult = repairJsonString(jsonText);
        
        if (repairResult.success) {
          const parsedObj = repairResult.json;
          
          // Skip if no document_index
          if (parsedObj.document_index === undefined) {
            // Try to infer document_index from position
            parsedObj.document_index = i;
          }
          
          // Find matching file
          const matchingFile = batchFiles.find(file => file.index === parseInt(parsedObj.document_index));
          
          if (matchingFile) {
            // Successfully matched and parsed
            results.push({
              index: parsedObj.document_index,
              success: true,
              extractedData: normalizeExtractedData(parsedObj, matchingFile.params || { month: 0, year: 0 }),
              originalItem: matchingFile.originalItem
            });
            continue;
          }
        }

        // If we get here, both direct parsing and repair failed
        // Attempt more advanced repair (for malformed JSON)
        try {
          // Try to extract the document_index directly with regex
          const indexMatch = jsonStr.match(/"document_index"\s*:\s*(\d+)/);
          if (indexMatch && indexMatch[1]) {
            const docIndex = parseInt(indexMatch[1]);
            const matchingFile = batchFiles.find(file => file.index === docIndex);

            if (matchingFile) {
              // Extract other fields with regex
              const bankMatch = jsonStr.match(/"bank_name"\s*:\s*"([^"]+)"/);
              const companyMatch = jsonStr.match(/"company_name"\s*:\s*"([^"]+)"/);
              const accountMatch = jsonStr.match(/"account_number"\s*:\s*"([^"]+)"/);
              const currencyMatch = jsonStr.match(/"currency"\s*:\s*"([^"]+)"/);
              const periodMatch = jsonStr.match(/"statement_period"\s*:\s*"([^"]+)"/);

              // Construct a partial result
              const partialData = {
                document_index: docIndex,
                bank_name: bankMatch ? bankMatch[1] : null,
                company_name: companyMatch ? companyMatch[1] : null,
                account_number: accountMatch ? accountMatch[1] : null,
                currency: currencyMatch ? currencyMatch[1] : null,
                statement_period: periodMatch ? periodMatch[1] : null,
                monthly_balances: []
              };

              // Add to results
              results.push({
                index: docIndex,
                success: true,
                extractedData: normalizeExtractedData(partialData, matchingFile.params || { month: 0, year: 0 }),
                originalItem: matchingFile.originalItem
              });
            }
          }
        } catch (repairError) {
          console.error("Failed to repair JSON:", repairError);
        }
      } catch (jsonError) {
        console.error("Failed to parse JSON object:", jsonError);
        console.log("Problematic JSON:", jsonStr.substring(0, 100) + "...");
      }
    }

    // If no results were parsed but we have batchFiles, try fallback extraction
    if (results.length === 0 && batchFiles.length > 0) {
      console.log("No valid JSON objects found, attempting fallback extraction");
      
      // Try to extract data for each file using regex patterns
      for (const file of batchFiles) {
        const fallbackData = extractFallbackData(responseText, file.params || { month: 0, year: 0 });
        
        if (fallbackData) {
          results.push({
            index: file.index,
            success: true,
            extractedData: fallbackData,
            originalItem: file.originalItem
          });
        }
      }
    }

    // Add errors for any missing files
    for (const file of batchFiles) {
      if (!results.some(r => r.index === file.index)) {
        results.push({
          index: file.index,
          success: false,
          error: 'Failed to extract data',
          originalItem: file.originalItem
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in parseExtractionResults:', error);

    // Return failed results for all files
    return batchFiles.map(file => ({
      index: file.index,
      success: false,
      error: `Extraction failed: ${error.message}`,
      originalItem: file.originalItem
    }));
  }
}

function repairJsonString(jsonStr) {
  try {
    // Check if already valid
    try {
      const parsed = JSON.parse(jsonStr);
      return { success: true, json: parsed };
    } catch (e) {
      // Not valid, continue with repairs
    }

    let jsonText = jsonStr.trim();

    // Remove any text before the first {
    const firstBrace = jsonText.indexOf('{');
    if (firstBrace > 0) {
      jsonText = jsonText.substring(firstBrace);
    }

    // Remove any text after the last }
    const lastBrace = jsonText.lastIndexOf('}');
    if (lastBrace >= 0 && lastBrace < jsonText.length - 1) {
      jsonText = jsonText.substring(0, lastBrace + 1);
    }

    // Balance braces
    const openBraces = (jsonText.match(/\{/g) || []).length;
    const closeBraces = (jsonText.match(/\}/g) || []).length;

    if (openBraces > closeBraces) {
      jsonText = jsonText + "}".repeat(openBraces - closeBraces);
    } else if (closeBraces > openBraces) {
      jsonText = "{".repeat(closeBraces - openBraces) + jsonText;
    }

    // Try to fix common JSON syntax errors
    jsonText = jsonText
      // Fix missing quotes on property names
      .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
      // Fix trailing commas
      .replace(/,\s*}/g, '}')
      .replace(/,\s*\]/g, ']');

    // Try parsing the repaired JSON
    try {
      const parsed = JSON.parse(jsonText);
      return { success: true, json: parsed };
    } catch (e) {
      return { success: false, error: e.message, repairedText: jsonText };
    }
  } catch (error) {
    return { success: false, error: "Repair failed: " + error.message };
  }
}

// Function to verify if a PDF is unlocked
async function verifyPdfIsUnlocked(file: File): Promise<boolean> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer
        });
        
        // Try to load the document without a password
        const pdfDoc = await loadingTask.promise;
        
        // Try to get text from the first page
        const page = await pdfDoc.getPage(1);
        const textContent = await page.getTextContent();
        
        // If we can get text content, the PDF is unlocked
        return textContent.items.length > 0;
    } catch (error) {
        console.error('Error verifying PDF unlock status:', error);
        return false;
    }
}


// Function to handle batch document extraction
async function batchExtractDocuments(files, prompt) {
  try {
    // Get the current API key
    const currentApiKey = getNextApiKey();
    const extractionModel = genAI.getGenerativeModel({
      model: EXTRACTION_MODEL,
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    // Create parts for the model with all files and their indexes
    const parts = [];
    parts.push(prompt);

    // Process each file to extract its text content
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Extract text from the first and last page of each PDF
      const pageCount = await getPdfPageCount(file.fileUrl);
      const pagesToExtract = [1];
      if (pageCount > 1) {
        pagesToExtract.push(pageCount);
      }

      const pageTextContent = await extractTextFromPdfPages(file.fileUrl, pagesToExtract);
      const pageText = Object.values(pageTextContent).join("\n\n--- PAGE BREAK ---\n\n");

      // Add the document text with its index
      parts.push(`Document ${i + 1} (index ${file.index}):\n${pageText}\n\n`);
    }

    // Make a single API call with all documents
    const result = await extractionModel.generateContent(parts);
    const responseText = result.response.text();

    // Parse the results
    const batchResults = [];

    // Look for JSON structures in the response
    // The response should contain multiple JSON objects, one for each document
    const jsonMatches = responseText.match(/\{[\s\S]*?\}/g) || [];

    for (let i = 0; i < jsonMatches.length; i++) {
      try {
        const parsedJson = JSON.parse(jsonMatches[i]);

        // Find which document this result belongs to
        const documentIndex = parsedJson.document_index || parsedJson.index || i;
        const originalIndex = files.find(f => f.index === parseInt(parsedJson.document_index))?.index || i;

        // Normalize the extracted data
        const normalizedData = normalizeExtractedData(parsedJson, {
          month: files[0].params?.month,
          year: files[0].params?.year
        });

        batchResults.push({
          index: originalIndex,
          success: true,
          extractedData: normalizedData,
          originalItem: files[originalIndex].originalItem
        });
      } catch (jsonError) {
        console.error('Error parsing JSON for batch item:', jsonError);

        // If parsing fails, add a failed result
        batchResults.push({
          index: i,
          success: false,
          error: 'Failed to parse extraction results'
        });
      }
    }

    // If we didn't get results for all documents, add failed results
    for (const file of files) {
      if (!batchResults.some(result => result.index === file.index)) {
        batchResults.push({
          index: file.index,
          success: false,
          error: 'No extraction result found for this document'
        });
      }
    }

    return batchResults;
  } catch (error) {
    console.error('Error in batch document extraction:', error);

    // Return failed results for all files
    return files.map(file => ({
      index: file.index,
      success: false,
      error: `Extraction failed: ${error.message}`
    }));
  }
}

// Helper functions for multi-month statements
function parseStatementPeriod(periodString) {
  if (!periodString) return null;

  // Try to match various date formats
  // Format: "January 2024" (single month)
  const singleMonthMatch = periodString.match(/(\w+)\s+(\d{4})/i);
  if (singleMonthMatch) {
    const month = new Date(`${singleMonthMatch[1]} 1, 2000`).getMonth() + 1;
    const year = parseInt(singleMonthMatch[2]);
    return {
      startMonth: month,
      startYear: year,
      endMonth: month,
      endYear: year
    };
  }

  // Format: "January - March 2024" or "January to March 2024"
  const sameYearMatch = periodString.match(/(\w+)\s*(?:-|to)\s*(\w+)\s+(\d{4})/i);
  if (sameYearMatch) {
    const startMonth = new Date(`${sameYearMatch[1]} 1, 2000`).getMonth() + 1;
    const endMonth = new Date(`${sameYearMatch[2]} 1, 2000`).getMonth() + 1;
    const year = parseInt(sameYearMatch[3]);
    return {
      startMonth,
      startYear: year,
      endMonth,
      endYear: year
    };
  }

  // Format: "January 2024 - March 2024" or "January 2024 to March 2024"
  const differentYearMatch = periodString.match(/(\w+)\s+(\d{4})\s*(?:-|to)\s*(\w+)\s+(\d{4})/i);
  if (differentYearMatch) {
    const startMonth = new Date(`${differentYearMatch[1]} 1, 2000`).getMonth() + 1;
    const startYear = parseInt(differentYearMatch[2]);
    const endMonth = new Date(`${differentYearMatch[3]} 1, 2000`).getMonth() + 1;
    const endYear = parseInt(differentYearMatch[4]);
    return {
      startMonth,
      startYear,
      endMonth,
      endYear
    };
  }

  return null;
}

// Helper function to generate month range from start to end
function generateMonthRange(startMonth, startYear, endMonth, endYear) {
  const months = [];

  for (let year = startYear; year <= endYear; year++) {
    const start = year === startYear ? startMonth : 1;
    const end = year === endYear ? endMonth : 12;

    for (let month = start; month <= end; month++) {
      months.push({ month, year });
    }
  }

  return months;
}

// Helper function to detect account number from filename
export function detectAccountNumberFromFilename(filename: string): string | null {
    // Common patterns for account numbers in filenames
    const patterns = [
        /acc[_\-]?(\d{5,})/i,              // Matches "acc_12345", "acc-12345"
        /acct[_\-]?(\d{5,})/i,             // Matches "acct_12345", "acct-12345"
        /account[_\-]?(\d{5,})/i,          // Matches "account_12345"
        /\b(\d{10,})\b/,                   // Matches any 10+ digit number
        /[_\-](\d{5,})[_\-]/               // Matches numbers between underscores/hyphens
    ];

    for (const pattern of patterns) {
        const match = filename.match(pattern);
        if (match && match[1]) {
            // Clean up the account number (remove any non-digits)
            const accountNumber = match[1].replace(/\D/g, '');
            console.log("Detected account number in filename:", accountNumber);
            return accountNumber;
        }
    }

    return null;
}

// Helper function to detect bank name from filename
export function getBankNameFromFilename(filename: string): string | null {
    // Common bank name patterns (add more as needed)
    const bankPatterns = [
        { pattern: /equity/i, name: "Equity Bank" },
        { pattern: /kcb/i, name: "KCB Bank" },
        { pattern: /cooperative|coop/i, name: "Cooperative Bank" },
        { pattern: /stanchart|standard[-\s]?chartered/i, name: "Standard Chartered" },
        { pattern: /absa/i, name: "ABSA Bank" },
        { pattern: /dtb|diamond[-\s]?trust/i, name: "Diamond Trust Bank" },
        { pattern: /ncba/i, name: "NCBA Bank" },
        { pattern: /family/i, name: "Family Bank" }
    ];

    for (const { pattern, name } of bankPatterns) {
        if (pattern.test(filename)) {
            console.log("Detected bank name in filename:", name);
            return name;
        }
    }

    return null;
}

// Enhanced file info detection that combines all detections
export function detectFileInfoFromFilename(filename: string): {
    accountNumber: string | null;
    bankName: string | null;
    password: string | null;
} {
    const accountNumber = detectAccountNumberFromFilename(filename);
    const bankName = getBankNameFromFilename(filename);
    
    // Password patterns (reusing from the previous implementation)
    const passwordPatterns = [
        /pass[_\-]?(\w+)/i,             // Matches "pass_123", "pass-123", "password123"
        /pwd[_\-]?(\w+)/i,              // Matches "pwd_123", "pwd-123"
        /\b(?:p|pw)[\s_\-]?(\w{4,})\b/i // Matches "p 1234", "pw_1234" with min 4 chars
    ];

    let password = null;
    for (const pattern of passwordPatterns) {
        const match = filename.match(pattern);
        if (match && match[1]) {
            password = match[1];
            console.log("Detected password from filename:", password);
            break;
        }
    }

    // Return the detected information
    return {
        accountNumber,
        bankName,
        password
    };
}

// Check if a PDF is password protected
export async function isPdfPasswordProtected(file: File): Promise<boolean> {
  try {
    // Use PDF.js to try loading the document without a password
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer)
    });

    try {
      // If the document loads without error, it's not password protected
      await loadingTask.promise;
      return false;
    } catch (error) {
      // Check if the error is a password exception
      if (error.name === 'PasswordException') {
        return true;
      }

      // For other types of errors, check if they contain password-related messages
      const errorMessage = error.message || '';
      return errorMessage.includes('password') ||
        errorMessage.includes('encrypted') ||
        errorMessage.includes('protection');
    }
  } catch (error) {
    console.error('Error checking if PDF is password protected:', error);
    // If we can't determine, assume it might be protected
    return true;
  }
}

// Apply password to files
export async function applyPasswordToFiles(file: File, password: string): Promise<boolean> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Try to load the document with the given password
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      password: password
    });

    try {
      // If the document loads with this password, it's correct
      await loadingTask.promise;
      return true;
    } catch (error) {
      // Check if it's a wrong password error
      if (error.name === 'PasswordException' && error.code === 2) {
        return false; // Wrong password
      }

      // Other error occurred
      console.error('Error applying password:', error);
      return false;
    }
  } catch (error) {
    console.error('Error in applyPasswordToFiles:', error);
    return false;
  }
}

// Remove password protection from PDF
export async function removePasswordProtection(file: File, password: string): Promise<File | null> {
  try {
    // Get a fresh array buffer from the file
    const arrayBuffer = await file.arrayBuffer();

    // First validate the password with PDF.js
    try {
      const uint8Array = new Uint8Array(arrayBuffer);
      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        password: password
      });
      await loadingTask.promise;
      // Password is valid, continue
    } catch (error) {
      console.error('Password validation failed:', error);
      return null;
    }

    // Get a fresh copy of the array buffer for pdf-lib
    const freshArrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(freshArrayBuffer);

    // Use PDF.js to extract all pages with the password
    const pdfJsDoc = await pdfjsLib.getDocument({
      data: uint8Array,
      password: password
    }).promise;

    // Create a new PDF document
    const newPdfDoc = await PDFDocument.create();

    // Process each page
    for (let i = 1; i <= pdfJsDoc.numPages; i++) {
      const page = await pdfJsDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });

      // Create a canvas to render the page
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');

      // Render the page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Add the rendered page as an image to the new PDF
      const pngData = canvas.toDataURL('image/png');
      const pngImage = await newPdfDoc.embedPng(pngData);

      // Add a page with the same dimensions
      const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);

      // Draw the image onto the page
      newPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height
      });
    }

    // Save the new unencrypted document
    const unlockedPdfBytes = await newPdfDoc.save();

    // Create a new File object with the unprotected PDF
    return new File(
      [unlockedPdfBytes],
      file.name,
      { type: 'application/pdf' }
    );
  } catch (error) {
    console.error('Error removing password protection:', error);
    return null;
  }
}

// Unlock PDF with password
async function unlockPDF(fileBuffer: ArrayBuffer, password: string) {
  try {
    // Create a new Uint8Array from the buffer to avoid detached buffer issues
    const uint8Array = new Uint8Array(fileBuffer);

    // Use PDF.js to load the document with the password
    const pdfJsDoc = await pdfjsLib.getDocument({
      data: uint8Array,
      password: password
    }).promise;

    // Create a new PDF document
    const newPdfDoc = await PDFDocument.create();

    // Process each page
    for (let i = 1; i <= pdfJsDoc.numPages; i++) {
      const page = await pdfJsDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });

      // Create a canvas to render the page
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');

      // Render the page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Add the rendered page as an image to the new PDF
      const pngData = canvas.toDataURL('image/png');
      const pngImage = await newPdfDoc.embedPng(pngData);

      // Add a page with the same dimensions
      const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);

      // Draw the image onto the page
      newPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height
      });
    }

    // Save the new unencrypted document
    return await newPdfDoc.save();
  } catch (error) {
    console.error('Error unlocking PDF:', error);
    throw error;
  }
}