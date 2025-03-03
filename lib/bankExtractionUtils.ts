// @ts-nocheck

import { supabase } from '@/lib/supabase'
import { GoogleGenerativeAI } from "@google/generative-ai";
import dayjs from 'dayjs';
import { API_KEYS } from './apiKeys';
import * as pdfjsLib from 'pdfjs-dist';

// Constants
const CHUNK_SIZE = 4; // Process 3 pages at a time
const MAX_CONCURRENT_REQUESTS = 4; // Process 4 chunks in parallel
const RATE_LIMIT_COOLDOWN = 60000; // 1 minute cooldown
const MAX_FAILURES = 5; // Max consecutive failures before cooling down

// Initialize the Gemini API
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


// Utility function to convert file to a format usable by the AI model
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

// Process a single chunk of PDF pages
async function processChunk(fileUrl, chunk, params, onProgress) {
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    try {
      onProgress?.(`Processing pages ${chunk.startPage} to ${chunk.endPage}...`);

      // Convert file to format compatible with Gemini API
      const filePart = await fileToGenerativePart(fileUrl);

      // Create prompt focusing only on this chunk of pages
      const prompt = `
Analyze pages ${chunk.startPage} to ${chunk.endPage} of this bank statement PDF and extract the following key financial information:

1. Bank Details:
   - Bank Name and Logo: Identify the official bank name (e.g., "Prime Bank", "Equity Bank") and from Logo and compare with Kenyan Banks write full name
   - Account Number: Extract the complete account number, including any formatting characters
   - Currency: Determine the currency used (e.g., KES, USD, EUR)

2. Statement Period:
   - Find the exact date range stated on the document (format: DD/MM/YYYY - DD/MM/YYYY) ..only use the greatest date for each month to determine    
   - Identify any specific month/year labels in the document

3. Account Holder:
   - Company Name: Extract the full, official name of the account holder

4. Balance Information:
   - Opening Balance: The starting balance at the beginning of the statement period
   - Closing Balance: The final balance at the end of the statement period

5. Monthly Breakdown (VERY IMPORTANT - find EVERY month mentioned in these pages):
   - Month and Year: Identify each distinct month covered in the statement
   - Monthly Opening Balance: First balance shown for that month, or balance brought forward
   - Monthly Closing Balance: Last balance shown for that month, or balance carried forward
   - Page Location: Note the actual page number where this information appears
   - SEARCH THOROUGHLY for ALL months mentioned on these pages

FOCUS ONLY ON PAGES ${chunk.startPage} to ${chunk.endPage} of the document.
Be thorough and find ALL months mentioned, even if they appear in tables, footnotes, or summaries.

Return the data in this structured JSON format:
{
  "bank_name": "Bank Name",
  "account_number": "Account Number",
  "currency": "Currency Code",
  "company_name": "Company Name",
  "statement_period": "Start Date - End Date",
  "opening_balance": number,
  "closing_balance": number,
  "monthly_balances": [
    {
      "month": month_number,
      "year": year_number,
      "opening_balance": number,
      "closing_balance": number,
      "statement_page": page_number,
      "opening_date": "YYYY-MM-DD",
      "closing_date": "YYYY-MM-DD"
    }
  ]
}`;

      // Rotate API keys if needed
      if (attempts > 0) {
        const nextKey = getNextApiKey();
        genAI = new GoogleGenerativeAI(nextKey);
      }

      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.2,
          topP: .8,
          topK: 40,
          maxOutputTokens: 8192,
        }
      });

      onProgress?.(`Analyzing content of pages ${chunk.startPage} to ${chunk.endPage}...`);
      const result = await model.generateContent([prompt, filePart]);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('No text generated from the model');
      }

      // Extract JSON from response
      let extractedData;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        throw new Error('Failed to parse JSON from model response');
      }

      // Helper function to parse currency amounts
      function parseCurrencyAmount(amount) {
        if (!amount) return null;
        const cleanedAmount = amount.toString().replace(/[^\d.-]/g, '');
        const parsedAmount = parseFloat(cleanedAmount);
        return isNaN(parsedAmount) ? null : parsedAmount;
      }

      // Normalize currency codes and data
      const normalizedData = {
        bank_name: extractedData.bank_name || null,
        company_name: extractedData.company_name || null,
        account_number: extractedData.account_number || null,
        currency: extractedData.currency ? normalizeCurrencyCode(extractedData.currency) : null,
        statement_period: extractedData.statement_period || null,
        opening_balance: typeof extractedData.opening_balance === 'string'
          ? parseCurrencyAmount(extractedData.opening_balance)
          : extractedData.opening_balance,
        closing_balance: typeof extractedData.closing_balance === 'string'
          ? parseCurrencyAmount(extractedData.closing_balance)
          : extractedData.closing_balance,
        monthly_balances: Array.isArray(extractedData.monthly_balances)
          ? extractedData.monthly_balances.map(balance => ({
            month: balance.month,
            year: balance.year,
            opening_balance: typeof balance.opening_balance === 'string'
              ? parseCurrencyAmount(balance.opening_balance)
              : balance.opening_balance,
            closing_balance: typeof balance.closing_balance === 'string'
              ? parseCurrencyAmount(balance.closing_balance)
              : balance.closing_balance,
            statement_page: balance.statement_page || chunk.startPage,
            highlight_coordinates: null,
            is_verified: false,
            verified_by: null,
            verified_at: null,
            opening_date: balance.opening_date || null,
            closing_date: balance.closing_date || null
          }))
          : []
      };

      // Reset API key status
      resetApiKeyStatus(API_KEYS[currentApiKeyIndex]);

      return {
        success: true,
        extractedData: normalizedData,
        chunk: chunk
      };

    } catch (error) {
      attempts++;
      console.error(`Extraction attempt ${attempts} failed for pages ${chunk.startPage}-${chunk.endPage}:`, error);

      // Check for rate limit error
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        markApiKeyFailure(API_KEYS[currentApiKeyIndex]);
      }

      if (attempts < MAX_ATTEMPTS) {
        onProgress?.(`Extraction failed. Retrying chunk (attempt ${attempts + 1}/${MAX_ATTEMPTS})...`);
        await delay(1000);
      } else {
        return {
          success: false,
          extractedData: {
            bank_name: null,
            company_name: null,
            account_number: null,
            currency: null,
            statement_period: null,
            opening_balance: null,
            closing_balance: null,
            monthly_balances: []
          },
          chunk: chunk,
          message: `Extraction failed after ${MAX_ATTEMPTS} attempts for pages ${chunk.startPage}-${chunk.endPage}.`
        };
      }
    }
  }
}

// Main extraction function using virtual chunking
export async function performBankStatementExtraction(
  fileUrl,
  params,
  onProgress = (message) => console.log(message)
) {
  try {
    onProgress('Starting bank statement extraction (first and last pages only)...');

    // Instead of creating chunks for all pages, define just two "chunks"
    const chunks = [
      { startPage: 1, endPage: 1, pageCount: 1 },  // First page
      { startPage: -1, endPage: -1, pageCount: 1 } // Last page (special marker for last page)
    ];

    onProgress('Processing first and last pages for basic details...');

    // Process first and last pages
    const firstPageResult = await processChunk(fileUrl, chunks[0], params, onProgress);
    const lastPageResult = await processSpecialChunk(fileUrl, chunks[1], params, onProgress);

    // Merge results from first and last pages
    const mergedData = mergeFirstAndLastPageResults(
      firstPageResult,
      lastPageResult,
      params,
      onProgress
    );

    onProgress('Basic extraction completed successfully.');

    return {
      success: true,
      extractedData: mergedData
    };
  } catch (error) {
    console.error('Error in extraction process:', error);
    // Return empty data fallback
    return {
      success: false,
      extractedData: {
        bank_name: null,
        company_name: null,
        account_number: null,
        currency: null,
        statement_period: null,
        opening_balance: null,
        closing_balance: null,
        monthly_balances: []
      },
      message: `Extraction failed: ${error.message}`
    };
  }
}
async function processSpecialChunk(fileUrl, chunk, params, onProgress) {
  try {
    onProgress('Processing last page of the document...');

    // First determine the total number of pages in the PDF
    const totalPages = await getPdfPageCount(fileUrl);

    // Update chunk to use actual last page number
    chunk.startPage = totalPages;
    chunk.endPage = totalPages;

    // Now process the last page using regular processing
    return await processChunk(fileUrl, chunk, params, onProgress);
  } catch (error) {
    console.error('Error processing last page:', error);
    return {
      success: false,
      extractedData: {
        bank_name: null,
        company_name: null,
        account_number: null,
        currency: null,
        statement_period: null,
        opening_balance: null,
        closing_balance: null,
        monthly_balances: []
      },
      chunk: chunk,
      message: 'Failed to process last page'
    };
  }
}


// Helper to get PDF page count
async function getPdfPageCount(fileUrl) {
  try {
    // If fileUrl is a string URL
    if (typeof fileUrl === 'string') {
      const pdf = await pdfjsLib.getDocument(fileUrl).promise;
      return pdf.numPages;
    }

    // If fileUrl is a File object
    if (fileUrl instanceof File) {
      const arrayBuffer = await fileUrl.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
      return pdf.numPages;
    }

    // Default fallback
    return 1;
  } catch (error) {
    console.error('Error getting PDF page count:', error);
    return 1; // Default to 1 page if we can't determine
  }
}

// Specialized merge function for first and last page results
function mergeFirstAndLastPageResults(firstPageResult, lastPageResult, params, onProgress) {
  onProgress('Merging data from first and last pages...');

  // Initialize with empty data
  const merged = {
    bank_name: null,
    company_name: null,
    account_number: null,
    currency: null,
    statement_period: null,
    opening_balance: null,
    closing_balance: null,
    monthly_balances: []
  };

  // First page typically has account details
  if (firstPageResult.success && firstPageResult.extractedData) {
    merged.bank_name = firstPageResult.extractedData.bank_name;
    merged.company_name = firstPageResult.extractedData.company_name;
    merged.account_number = firstPageResult.extractedData.account_number;
    merged.currency = firstPageResult.extractedData.currency;
    merged.statement_period = firstPageResult.extractedData.statement_period;
    merged.opening_balance = firstPageResult.extractedData.opening_balance;
  }

  // Last page might have closing balance or additional details
  if (lastPageResult.success && lastPageResult.extractedData) {
    // Only override if values weren't found in first page
    merged.bank_name = merged.bank_name || lastPageResult.extractedData.bank_name;
    merged.company_name = merged.company_name || lastPageResult.extractedData.company_name;
    merged.account_number = merged.account_number || lastPageResult.extractedData.account_number;
    merged.currency = merged.currency || lastPageResult.extractedData.currency;
    merged.statement_period = merged.statement_period || lastPageResult.extractedData.statement_period;
    merged.closing_balance = lastPageResult.extractedData.closing_balance;
  }

  // Ensure we have the requested month (for UI manual entry)
  merged.monthly_balances.push({
    month: params.month,
    year: params.year,
    opening_balance: merged.opening_balance || null,
    closing_balance: merged.closing_balance || null,
    statement_page: 1,
    highlight_coordinates: null,
    is_verified: false,
    verified_by: null,
    verified_at: null
  });

  return merged;
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

