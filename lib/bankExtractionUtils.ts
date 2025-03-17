// @ts-nocheck
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import * as pdfjsLib from 'pdfjs-dist';
import { API_KEYS } from './apiKeys';

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

// Extract text from specific PDF pages
async function extractTextFromPdfPages(fileUrl, pageNumbers) {
  try {
    let pdf;

    // Load PDF based on input type
    if (typeof fileUrl === 'string') {
      pdf = await pdfjsLib.getDocument(fileUrl).promise;
    } else if (fileUrl instanceof File) {
      const arrayBuffer = await fileUrl.arrayBuffer();
      pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
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

    return textByPage;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
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
    // { field: 'closing_balance', query: "What is the closing balance of the account?" },
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
// 7. Closing Balance: The final balance
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
  // "closing_balance": number,
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
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
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

// Normalize the extracted data
function normalizeExtractedData(extractedData, params) {
  // Helper function to ensure monthly balances structure
  const processMonthlyBalances = () => {
    const balances = Array.isArray(extractedData.monthly_balances)
      ? extractedData.monthly_balances.map(balance => ({
        month: balance.month,
        year: balance.year,
        // opening_balance: parseCurrencyAmount(balance.opening_balance),
        // closing_balance: parseCurrencyAmount(balance.closing_balance),
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
        // closing_balance: parseCurrencyAmount(extractedData.closing_balance),
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
    // closing_balance: parseCurrencyAmount(extractedData.closing_balance),
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

    // Get total page count
    const totalPages = await getPdfPageCount(fileUrl);
    onProgress(`Detected ${totalPages} pages in document`);

    // Define pages to process: first and last page
    const pages = [1];
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    onProgress(`Extracting text from pages ${pages.join(', ')}...`);
    const pageTextContent = await extractTextFromPdfPages(fileUrl, pages);

    // Process extraction using the page text
    const extractedData = await processExtraction(pageTextContent, params, onProgress);

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
        // closing_balance: null,
        monthly_balances: [{
          month: params.month,
          year: params.year,
          // opening_balance: null,
          // closing_balance: null,
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