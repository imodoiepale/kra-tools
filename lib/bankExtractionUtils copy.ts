// @ts-nocheck
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import * as pdfjsLib from 'pdfjs-dist';
import { API_KEYS } from './apiKeys';
import { supabase } from "./supabase";

// FIX: This is the critical line that resolves the "fake worker failed" error.
// It must be at the top level of the file to configure pdf.js before it's used.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Constants
const EMBEDDING_MODEL = "gemini-embedding-exp-03-07";
const EXTRACTION_MODEL = "gemini-2.0-flash";
const RATE_LIMIT_COOLDOWN = 60000;
const MAX_FAILURES = 5;

// Initialize the Gemini API with key rotation
let currentApiKeyIndex = 0;
let genAI = new GoogleGenerativeAI(API_KEYS[currentApiKeyIndex]);

const apiKeyStatus = new Map(API_KEYS.map(key => [key, {
  lastUsed: 0,
  failureCount: 0,
  cooldownUntil: 0
}]));

// API key management functions
const getNextApiKey = () => {
  const now = Date.now();
  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[i];
    const status = apiKeyStatus.get(key);
    if (!status || now < status.cooldownUntil) continue;
    if (now - status.lastUsed > RATE_LIMIT_COOLDOWN) status.failureCount = 0;
    if (status.failureCount < MAX_FAILURES) {
      currentApiKeyIndex = API_KEYS.indexOf(key);
      genAI = new GoogleGenerativeAI(key);
      return key;
    }
  }
  API_KEYS.forEach(key => apiKeyStatus.set(key, { lastUsed: 0, failureCount: 0, cooldownUntil: 0 }));
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
    console.log(`API key ...${key.slice(-4)} on cooldown.`);
  }
};

// Helper functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced date validation and parsing functions
const isValidDate = (dateValue) => {
  if (!dateValue) return false;

  if (dateValue instanceof Date) {
    return !isNaN(dateValue.getTime());
  }

  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    return !isNaN(parsed.getTime());
  }

  return false;
};

const createSafeDate = (year, month, day = 1) => {
  try {
    // Validate inputs
    if (!year || !month || year < 1900 || year > 2100 || month < 1 || month > 12) {
      console.error('Invalid date parameters:', { year, month, day });
      return null;
    }

    // Create date (month is 0-indexed in Date constructor)
    const date = new Date(year, month - 1, day);

    // Verify the date was created correctly
    if (date.getFullYear() !== year || date.getMonth() !== (month - 1)) {
      console.error('Date creation resulted in different values:', {
        expected: { year, month, day },
        actual: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
      });
      return null;
    }

    return date;
  } catch (error) {
    console.error('Error creating date:', error, { year, month, day });
    return null;
  }
};

// Enhanced month name to number conversion
const getMonthNumber = (monthName) => {
  if (!monthName) return null;

  const monthLower = monthName.toLowerCase().trim();

  const fullMonths = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  const abbrevMonths = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];

  // Check full names first
  const fullIndex = fullMonths.indexOf(monthLower);
  if (fullIndex !== -1) {
    return fullIndex + 1;
  }

  // Check abbreviated names
  const abbrevIndex = abbrevMonths.indexOf(monthLower);
  if (abbrevIndex !== -1) {
    return abbrevIndex + 1;
  }

  // Try partial matches for full names (at least 3 characters)
  if (monthLower.length >= 3) {
    for (let i = 0; i < fullMonths.length; i++) {
      if (fullMonths[i].startsWith(monthLower)) {
        return i + 1;
      }
    }
  }

  return null;
};

// Currency normalization
const normalizeCurrencyCode = (code) => {
  if (!code) return 'USD';
  const upperCode = code.toUpperCase().trim();
  const currencyMap = {
    'EURO': 'EUR', 'EUROS': 'EUR', 'US DOLLAR': 'USD', 'US DOLLARS': 'USD', 'USDOLLAR': 'USD',
    'POUND': 'GBP', 'POUNDS': 'GBP', 'STERLING': 'GBP', 'KENYA SHILLING': 'KES',
    'KENYA SHILLINGS': 'KES', 'KENYAN SHILLING': 'KES', 'KSH': 'KES', 'K.SH': 'KES',
    'KSHS': 'KES', 'K.SHS': 'KES', 'SH': 'KES'
  };
  return currencyMap[upperCode] || upperCode;
};

// Currency amount parsing
function parseCurrencyAmount(amount) {
  if (amount === null || amount === undefined) return null;
  const amountStr = String(amount).replace(/[^\d.-]/g, '');
  const parsedAmount = parseFloat(amountStr);
  return isNaN(parsedAmount) ? null : parsedAmount;
}

// Enhanced statement period parsing with comprehensive error handling
export function parseStatementPeriod(periodString) {
  if (!periodString || typeof periodString !== 'string') {
    return null;
  }

  console.log('Parsing statement period:', periodString);

  try {
    // Clean and normalize the period string
    const normalizedPeriod = periodString.trim().replace(/\s+/g, ' ');

    // Pattern 1: Date range format "01/01/2024 - 30/07/2024" or "DD/MM/YYYY - DD/MM/YYYY"
    const dateRangePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–—]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    const dateRangeMatch = normalizedPeriod.match(dateRangePattern);

    if (dateRangeMatch) {
      const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = dateRangeMatch;

      console.log('Date range match found:', {
        startDay, startMonth, startYear,
        endDay, endMonth, endYear
      });

      const startMonthNum = parseInt(startMonth, 10);
      const startYearNum = parseInt(startYear, 10);
      const endMonthNum = parseInt(endMonth, 10);
      const endYearNum = parseInt(endYear, 10);

      // Validate the parsed dates
      if (startMonthNum >= 1 && startMonthNum <= 12 &&
        endMonthNum >= 1 && endMonthNum <= 12 &&
        startYearNum > 1900 && endYearNum > 1900) {

        return {
          startMonth: startMonthNum,
          startYear: startYearNum,
          endMonth: endMonthNum,
          endYear: endYearNum
        };
      }
    }

    // Pattern 2: Alternative date formats "1/1/2024 to 30/7/2024", "01-01-2024 to 30-07-2024"
    const altDateRangePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(?:to|[-–—])\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i;
    const altDateRangeMatch = normalizedPeriod.match(altDateRangePattern);

    if (altDateRangeMatch) {
      const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = altDateRangeMatch;

      const startMonthNum = parseInt(startMonth, 10);
      const startYearNum = parseInt(startYear, 10);
      const endMonthNum = parseInt(endMonth, 10);
      const endYearNum = parseInt(endYear, 10);

      if (startMonthNum >= 1 && startMonthNum <= 12 &&
        endMonthNum >= 1 && endMonthNum <= 12 &&
        startYearNum > 1900 && endYearNum > 1900) {

        return {
          startMonth: startMonthNum,
          startYear: startYearNum,
          endMonth: endMonthNum,
          endYear: endYearNum
        };
      }
    }

    // Pattern 3: Month name format "January 2024" (single month)
    const singleMonthMatch = normalizedPeriod.match(/^(\w+)\s+(\d{4})$/i);
    if (singleMonthMatch) {
      const monthName = singleMonthMatch[1].toLowerCase();
      const year = parseInt(singleMonthMatch[2], 10);

      const monthNumber = getMonthNumber(monthName);
      if (monthNumber && year > 1900) {
        return {
          startMonth: monthNumber,
          startYear: year,
          endMonth: monthNumber,
          endYear: year
        };
      }
    }

    // Pattern 4: Month range same year "January - March 2024" or "January to March 2024"
    const sameYearMatch = normalizedPeriod.match(/(\w+)\s*(?:[-–—]|to)\s*(\w+)\s+(\d{4})/i);
    if (sameYearMatch) {
      const startMonthName = sameYearMatch[1].toLowerCase();
      const endMonthName = sameYearMatch[2].toLowerCase();
      const year = parseInt(sameYearMatch[3], 10);

      const startMonth = getMonthNumber(startMonthName);
      const endMonth = getMonthNumber(endMonthName);

      if (startMonth && endMonth && year > 1900) {
        return {
          startMonth,
          startYear: year,
          endMonth,
          endYear: year
        };
      }
    }

    // Pattern 5: Month range different years "January 2024 - March 2025" or "January 2024 to March 2025"
    const differentYearMatch = normalizedPeriod.match(/(\w+)\s+(\d{4})\s*(?:[-–—]|to)\s*(\w+)\s+(\d{4})/i);
    if (differentYearMatch) {
      const startMonthName = differentYearMatch[1].toLowerCase();
      const startYear = parseInt(differentYearMatch[2], 10);
      const endMonthName = differentYearMatch[3].toLowerCase();
      const endYear = parseInt(differentYearMatch[4], 10);

      const startMonth = getMonthNumber(startMonthName);
      const endMonth = getMonthNumber(endMonthName);

      if (startMonth && endMonth && startYear > 1900 && endYear > 1900) {
        return {
          startMonth,
          startYear,
          endMonth,
          endYear
        };
      }
    }

    // Pattern 6: Abbreviated month format "Jan 2024 - Mar 2024"
    const abbreviatedMatch = normalizedPeriod.match(/(\w{3})\s+(\d{4})\s*(?:[-–—]|to)\s*(\w{3})\s+(\d{4})/i);
    if (abbreviatedMatch) {
      const startMonthAbbr = abbreviatedMatch[1].toLowerCase();
      const startYear = parseInt(abbreviatedMatch[2], 10);
      const endMonthAbbr = abbreviatedMatch[3].toLowerCase();
      const endYear = parseInt(abbreviatedMatch[4], 10);

      const startMonth = getMonthNumber(startMonthAbbr);
      const endMonth = getMonthNumber(endMonthAbbr);

      if (startMonth && endMonth && startYear > 1900 && endYear > 1900) {
        return {
          startMonth,
          startYear,
          endMonth,
          endYear
        };
      }
    }

    // Pattern 7: Try to extract any dates from the string as fallback
    const allDatesPattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
    const allDates = [...normalizedPeriod.matchAll(allDatesPattern)];

    if (allDates.length >= 2) {
      // Take first and last date
      const firstDate = allDates[0];
      const lastDate = allDates[allDates.length - 1];

      const startMonth = parseInt(firstDate[2], 10); // Assuming DD/MM/YYYY format
      const startYear = parseInt(firstDate[3], 10);
      const endMonth = parseInt(lastDate[2], 10);
      const endYear = parseInt(lastDate[3], 10);

      if (startMonth >= 1 && startMonth <= 12 &&
        endMonth >= 1 && endMonth <= 12 &&
        startYear > 1900 && endYear > 1900) {

        return {
          startMonth,
          startYear,
          endMonth,
          endYear
        };
      }
    }

    console.warn('Could not parse statement period:', periodString);
    return null;

  } catch (error) {
    console.error('Error parsing statement period:', error, periodString);
    return null;
  }
}

// Enhanced month range generation with validation
export function generateMonthRange(startMonth, startYear, endMonth, endYear) {
  console.log(`Generating month range from ${startMonth}/${startYear} to ${endMonth}/${endYear}`);

  // Validate inputs
  if (!startMonth || !startYear || !endMonth || !endYear) {
    console.warn("Invalid inputs to generateMonthRange:", { startMonth, startYear, endMonth, endYear });
    return [];
  }

  // Ensure all inputs are numbers and within valid ranges
  startMonth = Math.max(1, Math.min(12, Number(startMonth)));
  startYear = Number(startYear);
  endMonth = Math.max(1, Math.min(12, Number(endMonth)));
  endYear = Number(endYear);

  // Validate years
  if (startYear < 1900 || endYear < 1900 || startYear > 2100 || endYear > 2100) {
    console.error("Invalid year range:", { startYear, endYear });
    return [{ month: startMonth, year: startYear }];
  }

  // Handle case where end date is before start date
  if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) {
    console.warn("End date is before start date, swapping:", { startMonth, startYear, endMonth, endYear });
    [startMonth, endMonth] = [endMonth, startMonth];
    [startYear, endYear] = [endYear, startYear];
  }

  const months = [];
  let currentYear = startYear;
  let currentMonth = startMonth;

  // Generate the range with safety limits to prevent infinite loops
  let iterations = 0;
  const maxIterations = 1000; // Safety limit

  while ((currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) && iterations < maxIterations) {
    months.push({
      month: currentMonth,
      year: currentYear
    });

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    iterations++;
  }

  if (iterations >= maxIterations) {
    console.error("Month range generation hit safety limit");
  }

  console.log(`Generated ${months.length} months:`, months);
  return months;
}

// Enhanced complete month range with default balance structure
export function generateCompleteMonthRange(startMonth, startYear, endMonth, endYear) {
  const basicRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

  return basicRange.map(({ month, year }) => ({
    month,
    year,
    opening_balance: null,
    closing_balance: null,
    is_verified: false,
    statement_page: 1,
    closing_date: null,
    verified_by: null,
    verified_at: null
  }));
}

// PDF processing functions with enhanced error handling
export async function getPdfDocument(fileUrl, password = null) {
  try {
    const loadingTaskOptions = { password };
    if (typeof fileUrl === 'string') {
      loadingTaskOptions.url = fileUrl;
    } else if (fileUrl instanceof File) {
      const arrayBuffer = await fileUrl.arrayBuffer();
      loadingTaskOptions.data = new Uint8Array(arrayBuffer);
    } else {
      throw new Error("Invalid file input type");
    }
    const pdf = await pdfjsLib.getDocument(loadingTaskOptions).promise;
    return { success: true, pdf };
  } catch (error) {
    if (error.name === 'PasswordException') {
      return { success: false, error: "PDF is password protected", requiresPassword: true };
    }
    console.error('Error getting PDF document:', error);
    return { success: false, error: error.message };
  }
}

// Enhanced function to extract text from ALL pages intelligently
async function extractTextFromAllPages(pdf, onProgress = null) {
  const textByPage = {};
  const pageCount = pdf.numPages;

  console.log(`Starting intelligent extraction from all ${pageCount} pages`);

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    try {
      if (onProgress) {
        onProgress(`Extracting text from page ${pageNum}/${pageCount}...`);
      }

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Enhanced text extraction with positioning and formatting
      const textItems = textContent.items.map(item => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height
      }));

      // Sort by Y position (top to bottom) then X position (left to right)
      textItems.sort((a, b) => {
        const yDiff = Math.abs(a.y - b.y);
        if (yDiff < 5) { // Same line
          return a.x - b.x;
        }
        return b.y - a.y; // Higher Y value = higher on page
      });

      // Group into lines and reconstruct text with better formatting
      const lines = [];
      let currentLine = [];
      let lastY = null;

      for (const item of textItems) {
        if (lastY === null || Math.abs(item.y - lastY) < 5) {
          currentLine.push(item.text);
        } else {
          if (currentLine.length > 0) {
            lines.push(currentLine.join(' '));
          }
          currentLine = [item.text];
        }
        lastY = item.y;
      }

      if (currentLine.length > 0) {
        lines.push(currentLine.join(' '));
      }

      textByPage[pageNum] = {
        rawText: lines.join('\n'),
        lineCount: lines.length,
        hasContent: lines.length > 0 && lines.some(line => line.trim().length > 0)
      };

    } catch (error) {
      console.error(`Error extracting text from page ${pageNum}:`, error);
      textByPage[pageNum] = {
        rawText: `Error extracting text from page ${pageNum}: ${error.message}`,
        lineCount: 0,
        hasContent: false,
        error: error.message
      };
    }
  }

  console.log(`Completed text extraction from ${pageCount} pages`);
  return { success: true, textByPage, totalPages: pageCount };
}

// Enhanced embedding generation with chunking for large documents
async function generateDocumentEmbeddings(allPageText, onProgress = null) {
  try {
    if (onProgress) onProgress('Generating document embeddings...');

    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    // Split large documents into chunks for embedding
    const maxChunkSize = 5000; // characters per chunk
    const chunks = [];

    if (allPageText.length <= maxChunkSize) {
      chunks.push(allPageText);
    } else {
      // Split by pages first, then by size if needed
      const pages = allPageText.split('--- PAGE');
      let currentChunk = '';

      for (const page of pages) {
        if ((currentChunk + page).length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = page;
        } else {
          currentChunk += (currentChunk ? '--- PAGE' : '') + page;
        }
      }

      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
    }

    console.log(`Generating embeddings for ${chunks.length} chunks`);

    // Generate embeddings for each chunk
    const embeddings = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        if (onProgress) onProgress(`Generating embeddings for chunk ${i + 1}/${chunks.length}...`);

        const result = await embeddingModel.embedContent({
          content: { parts: [{ text: chunks[i] }], role: "user" }
        });

        embeddings.push({
          chunkIndex: i,
          embedding: result.embedding,
          text: chunks[i],
          size: chunks[i].length
        });

        // Small delay to avoid rate limiting
        if (i < chunks.length - 1) {
          await delay(100);
        }
      } catch (error) {
        console.warn(`Could not generate embeddings for chunk ${i}:`, error.message);
        embeddings.push({
          chunkIndex: i,
          embedding: null,
          text: chunks[i],
          size: chunks[i].length,
          error: error.message
        });
      }
    }

    return {
      success: true,
      embeddings,
      totalChunks: chunks.length,
      totalSize: allPageText.length
    };

  } catch (error) {
    console.warn("Could not generate document embeddings:", error.message);
    return {
      success: false,
      error: error.message,
      embeddings: [],
      totalChunks: 0,
      totalSize: allPageText.length
    };
  }
}

// Enhanced extraction with intelligent scenario handling
async function processIntelligentExtraction(textByPage, params, embeddings, onProgress) {
  try {
    onProgress?.('Running intelligent extraction with scenario analysis...');

    // Combine all page text with clear page separators
    const allPageText = Object.entries(textByPage)
      .map(([pageNum, pageData]) => `--- PAGE ${pageNum} ---\n${pageData.rawText}\n`)
      .join('\n');

    // Enhanced extraction prompt with intelligent scenario handling
    const extractionPrompt = `
You are an advanced bank statement analyzer. Analyze the following bank statement text and extract information with intelligent scenario handling.

**CRITICAL INSTRUCTIONS:**
1. First, confirm that embeddings were properly generated for this document
2. Use the embeddings to understand document structure and locate key information
3. Handle the following CLOSING BALANCE SCENARIOS intelligently:

**SCENARIO 1 - Complete Month:** 
- Statement period ends on last day of month AND has transactions on/near that date
- Extract the final closing balance

**SCENARIO 2 - Incomplete Month (Current Month):**
- Statement period shows current/future dates but last transaction is several days before period end
- Mark closing_balance as null and note "INCOMPLETE_MONTH"
- Adjust statement_period end date to match last transaction date

**SCENARIO 3 - Early Period End:**
- Statement says period ends on 30th but last transaction is on 25th
- Use the balance from the 25th (last transaction date)
- Note the discrepancy

**SCENARIO 4 - Multiple Monthly Summaries:**
- Statement contains multiple months with separate closing balances
- Extract each month's closing balance separately
- Validate each month's completeness

**SCENARIO 5 - Range Statement with Partial Months:**
- Multi-month statement where some months are incomplete
- Mark incomplete months with null balances
- Only extract balances for complete months

**JSON Response Format (respond with ONLY valid JSON):**
{
  "embeddings_confirmed": true/false,
  "bank_name": "string | null",
  "account_number": "string | null", 
  "company_name": "string | null",
  "currency": "string | null",
  "statement_period": "string | DD/MM/YYYY - DD/MM/YYYY format",
  "statement_period_adjusted": "string | null (if period was adjusted)",
  "period_adjustment_reason": "string | null",
  "last_transaction_date": "string | DD/MM/YYYY",
  "monthly_balances": [
    {
      "month": "number (1-12)",
      "year": "number",
      "opening_balance": "number | null",
      "closing_balance": "number | null", 
      "closing_date": "string | DD/MM/YYYY",
      "balance_scenario": "COMPLETE_MONTH | INCOMPLETE_MONTH | EARLY_END | LAST_TRANSACTION | null",
      "is_complete": true/false,
      "statement_page": "number",
      "notes": "string | null"
    }
  ],
  "extraction_confidence": "HIGH | MEDIUM | LOW",
  "data_quality_issues": ["array of strings describing any issues"],
  "total_pages_analyzed": "number"
}

**VALIDATION RULES:**
- If period is incomplete, closing_balance MUST be null
- Always prioritize actual transaction dates over stated period end dates
- If last transaction is >5 days before period end, mark as incomplete
- For current month statements, be extra cautious about completeness

**Document Text:**
${allPageText}

**Embeddings Status:** ${embeddings.success ? `Generated ${embeddings.totalChunks} chunks` : 'Failed to generate'}
`;

    // Use the extraction model with enhanced configuration
    const extractionModel = genAI.getGenerativeModel({
      model: EXTRACTION_MODEL,
      generationConfig: {
        temperature: 0.1, // Lower temperature for more consistent results
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

    const result = await extractionModel.generateContent([extractionPrompt]);
    const responseText = result.response.text();

    onProgress?.('Processing intelligent extraction results...');

    // Extract and parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch && jsonMatch[0]) {
      try {
        const extractedData = JSON.parse(jsonMatch[0]);

        // Validate and enhance the extracted data
        const enhancedData = validateAndEnhanceExtraction(extractedData, params);

        return enhancedData;
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        throw new Error('AI returned malformed JSON');
      }
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (error) {
    console.error('Error in intelligent extraction process:', error);
    throw new Error(`Failed to process intelligent extraction: ${error.message}`);
  }
}

// Validation and enhancement of extracted data
function validateAndEnhanceExtraction(extractedData, params) {
  try {
    // Validate embeddings confirmation
    if (!extractedData.embeddings_confirmed) {
      console.warn('Embeddings were not properly confirmed by AI');
    }

    // Enhance monthly balances with validation
    const enhancedBalances = (extractedData.monthly_balances || []).map(balance => {
      const enhanced = {
        month: parseInt(balance.month, 10),
        year: parseInt(balance.year, 10),
        opening_balance: parseCurrencyAmount(balance.opening_balance),
        closing_balance: parseCurrencyAmount(balance.closing_balance),
        closing_date: balance.closing_date || null,
        balance_scenario: balance.balance_scenario || null,
        is_complete: balance.is_complete !== false, // Default to true unless explicitly false
        statement_page: balance.statement_page || 1,
        notes: balance.notes || null,
        verified_by: null,
        verified_at: null
      };

      // Apply intelligent validation rules
      if (enhanced.balance_scenario === 'INCOMPLETE_MONTH') {
        enhanced.closing_balance = null;
        enhanced.is_complete = false;
      }

      // Validate month and year
      if (isNaN(enhanced.month) || enhanced.month < 1 || enhanced.month > 12) {
        enhanced.month = params.month + 1; // Fallback to expected month
      }

      if (isNaN(enhanced.year) || enhanced.year < 1900) {
        enhanced.year = params.year; // Fallback to expected year
      }

      return enhanced;
    }).filter(b => !isNaN(b.month) && !isNaN(b.year));

    // Determine if statement period was adjusted
    let finalStatementPeriod = extractedData.statement_period;
    if (extractedData.statement_period_adjusted) {
      finalStatementPeriod = extractedData.statement_period_adjusted;
    }

    return {
      bank_name: extractedData.bank_name || null,
      company_name: extractedData.company_name || null,
      account_number: extractedData.account_number || null,
      currency: extractedData.currency ? normalizeCurrencyCode(extractedData.currency) : null,
      statement_period: finalStatementPeriod || null,
      statement_period_original: extractedData.statement_period || null,
      statement_period_adjusted: extractedData.statement_period_adjusted || null,
      period_adjustment_reason: extractedData.period_adjustment_reason || null,
      last_transaction_date: extractedData.last_transaction_date || null,
      monthly_balances: enhancedBalances,
      extraction_confidence: extractedData.extraction_confidence || 'MEDIUM',
      data_quality_issues: extractedData.data_quality_issues || [],
      total_pages_analyzed: extractedData.total_pages_analyzed || 0,
      embeddings_confirmed: extractedData.embeddings_confirmed || false,
      processing_metadata: {
        extraction_date: new Date().toISOString(),
        extraction_version: '2.0-intelligent',
        scenarios_analyzed: true,
        all_pages_processed: true
      }
    };
  } catch (error) {
    console.error('Error validating extraction data:', error);
    throw new Error(`Validation failed: ${error.message}`);
  }
}

// Helper function to create empty extraction data
function createEmptyExtractionData() {
  return {
    bank_name: null,
    company_name: null,
    account_number: null,
    currency: null,
    statement_period: null,
    statement_period_adjusted: null,
    period_adjustment_reason: null,
    last_transaction_date: null,
    closing_balance: null,
    monthly_balances: [],
    extraction_confidence: 'LOW',
    data_quality_issues: ['Extraction failed'],
    total_pages_analyzed: 0,
    embeddings_confirmed: false,
    processing_metadata: {
      extraction_date: new Date().toISOString(),
      extraction_version: '2.0-intelligent',
      scenarios_analyzed: false,
      all_pages_processed: false
    }
  };
}

async function extractTextFromPdfPages(pdf, pageNumbers) {
  const textByPage = {};
  for (const pageNum of pageNumbers) {
    const actualPageNum = pageNum === -1 ? pdf.numPages : pageNum;
    if (actualPageNum < 1 || actualPageNum > pdf.numPages) continue;
    const page = await pdf.getPage(actualPageNum);
    const textContent = await page.getTextContent();
    textByPage[actualPageNum] = textContent.items.map(item => item.str).join(' ');
  }
  return { success: true, textByPage };
}

async function generateTextEmbeddings(textContent) {
  try {
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await embeddingModel.embedContent({ content: { parts: [{ text: textContent }], role: "user" } });
    return result.embedding;
  } catch (error) {
    console.warn("Could not generate embeddings:", error.message);
    return null;
  }
}

function normalizeExtractedData(extractedData, params) {
  const balances = Array.isArray(extractedData.monthly_balances)
    ? extractedData.monthly_balances.map(balance => ({
      month: parseInt(balance.month, 10),
      year: parseInt(balance.year, 10),
      opening_balance: parseCurrencyAmount(balance.opening_balance),
      closing_balance: parseCurrencyAmount(balance.closing_balance),
      statement_page: balance.statement_page || 1,
    })).filter(b => !isNaN(b.month) && !isNaN(b.year))
    : [];

  return {
    bank_name: extractedData.bank_name || null,
    company_name: extractedData.company_name || null,
    account_number: extractedData.account_number || null,
    currency: extractedData.currency ? normalizeCurrencyCode(extractedData.currency) : null,
    statement_period: extractedData.statement_period || null,
    monthly_balances: balances,
  };
}

async function processExtraction(pageTextContent, params, onProgress) {
  try {
    onProgress?.('Generating embeddings for bank statement pages...');
    const pageText = Object.values(pageTextContent).join("\n\n--- PAGE BREAK ---\n\n");
    await generateTextEmbeddings(pageText);

    onProgress?.('Running extraction queries...');
    const extractionPrompt = `
   Analyze the following bank statement text. Your entire response MUST be only a single, valid JSON object.
   Do not include any other text, explanations, or markdown formatting like \`\`\`json.
   
   **JSON Schema to follow:**
   {
     "bank_name": "string | null",
     "account_number": "string | null",
     "company_name": "string | null",
     "currency": "string | null",
     "statement_period": "string | null (format as DD/MM/YYYY - DD/MM/YYYY)",
     "monthly_balances": [
       {
         "month": "number (1-12)",
         "year": "number (e.g., 2024)",
         "opening_balance": "number | null",
         "closing_balance": "number | null",
         "statement_page": "number"
       }
     ]
   }

   If you cannot find a value for a field, use null.
   `;

    const extractionModel = genAI.getGenerativeModel({ model: EXTRACTION_MODEL });
    const result = await extractionModel.generateContent([extractionPrompt, pageText]);
    const responseText = result.response.text();
    onProgress?.('Processing extracted information...');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch && jsonMatch[0]) {
      try {
        const extractedData = JSON.parse(jsonMatch[0]);
        return normalizeExtractedData(extractedData, params);
      } catch (jsonError) {
        throw new Error('AI returned malformed JSON');
      }
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (error) {
    console.error('Error in extraction process:', error);
    throw new Error('Failed to parse extraction results');
  }
}

// Main extraction function with enhanced error handling - KEEPING ORIGINAL NAME
export async function performBankStatementExtraction(fileUrl, params, onProgress = (message) => console.log(message)) {
  try {
    onProgress('Starting enhanced bank statement extraction...');

    // Get PDF document
    const docResult = await getPdfDocument(fileUrl, params.password);
    if (!docResult.success) {
      if (docResult.requiresPassword) {
        return {
          success: false,
          requiresPassword: true,
          message: docResult.error,
          extractedData: createEmptyExtractionData()
        };
      }
      throw new Error(docResult.error);
    }

    const pdf = docResult.pdf;
    onProgress(`Detected ${pdf.numPages} pages in document`);

    // Extract text from ALL pages intelligently
    onProgress('Extracting text from all pages...');
    const textResult = await extractTextFromAllPages(pdf, onProgress);
    if (!textResult.success) {
      throw new Error('Failed to extract text from pages');
    }

    // Combine all page text for embedding generation
    const allPageText = Object.entries(textResult.textByPage)
      .map(([pageNum, pageData]) => `--- PAGE ${pageNum} ---\n${pageData.rawText}\n`)
      .join('\n');

    onProgress('Generating document embeddings...');
    const embeddings = await generateDocumentEmbeddings(allPageText, onProgress);

    onProgress('Processing intelligent extraction...');
    const extractedData = await processIntelligentExtraction(
      textResult.textByPage,
      params,
      embeddings,
      onProgress
    );

    // Find main closing balance for the target month
    const mainClosingBalance = extractedData.monthly_balances?.find(b =>
      b.month === (params.month + 1) && b.year === params.year
    )?.closing_balance;

    const finalData = {
      ...extractedData,
      closing_balance: mainClosingBalance !== undefined ? mainClosingBalance : null,
    };

    onProgress('Enhanced extraction completed successfully');
    return { success: true, extractedData: finalData };

  } catch (error) {
    console.error('Error in enhanced bank statement extraction:', error);
    return {
      success: false,
      message: error.message,
      extractedData: createEmptyExtractionData(),
    };
  }
}

// Enhanced statement cycle creation
export const getOrCreateStatementCycle = async (year: number, month: number, statementType?: 'monthly' | 'range') => {
  try {
    // month should be 0-indexed (0=January, 1=February, etc.)
    const monthStr = (month + 1).toString().padStart(2, '0'); // Convert to 1-indexed and pad
    let monthYearStr = `${year}-${monthStr}`;

    // FIX: For range statements, create a different cycle identifier to avoid conflicts
    if (statementType === 'range') {
      monthYearStr = `${year}-${monthStr}-range`;
    }

    console.log('Creating/finding statement cycle for:', { year, month, monthYearStr, statementType });

    // 1. Try to find existing cycle
    const { data: existingCycle, error: findError } = await supabase
      .from('statement_cycles')
      .select('id')
      .eq('month_year', monthYearStr)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      console.error('Error finding statement cycle:', findError);
      throw findError;
    }

    if (existingCycle) {
      console.log('Using existing cycle:', existingCycle.id, 'for', monthYearStr);
      return existingCycle.id;
    }

    // 2. Create new cycle if not found
    console.log('Creating new statement cycle for:', monthYearStr);
    const { data: newCycle, error: createError } = await supabase
      .from('statement_cycles')
      .insert({
        month_year: monthYearStr,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating statement cycle:', createError);
      throw createError;
    }

    if (!newCycle) {
      throw new Error('Failed to create new statement cycle');
    }

    console.log('Created new cycle:', newCycle.id, 'for', monthYearStr);
    return newCycle.id;
  } catch (error) {
    console.error('Error in getOrCreateStatementCycle:', {
      error,
      message: error.message,
      year,
      month,
      statementType
    });
    throw error;
  }
};

// Enhanced utility for creating statement cycles for a period
export async function createStatementCyclesForPeriod(statementPeriod) {
  const periodDates = parseStatementPeriod(statementPeriod);
  if (!periodDates) return [];

  const { startMonth, startYear, endMonth, endYear } = periodDates;
  const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);
  const createdCycles = [];

  for (const { month, year } of monthsInRange) {
    try {
      const cycleId = await getOrCreateStatementCycle(year, month - 1); // Convert to 0-indexed
      if (cycleId) {
        createdCycles.push({
          id: cycleId,
          month_year: `${year}-${month.toString().padStart(2, '0')}`
        });
      }
    } catch (error) {
      console.error(`Error creating cycle for ${month}/${year}:`, error);
    }
  }

  return createdCycles;
}

// Enhanced range checking for validation
export function validateStatementPeriodRange(extractedPeriod, selectedMonth, selectedYear) {
  if (!extractedPeriod) {
    return { isValid: false, message: 'No statement period found' };
  }

  const periodDates = parseStatementPeriod(extractedPeriod);
  if (!periodDates) {
    return { isValid: false, message: 'Could not parse statement period' };
  }

  const { startMonth, startYear, endMonth, endYear } = periodDates;
  const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

  // Check if selected month/year is within the range
  const isIncluded = monthsInRange.some(
    m => m.month === (selectedMonth + 1) && m.year === selectedYear
  );

  return {
    isValid: isIncluded,
    message: isIncluded
      ? `Statement period covers ${monthsInRange.length} months including selected month`
      : `Statement period does not include selected month`,
    monthsInRange
  };
}

// Enhanced password detection patterns
export function detectPasswordFromFilename(filename) {
  if (!filename) return null;

  const passwordPatterns = [
    /pass(?:word)?[_\-\s]*[:\=]?\s*(\w+)/i,
    /pwd[_\-\s]*[:\=]?\s*(\w+)/i,
    /p[_\-\s]*[:\=]?\s*(\d{4,})/i,
    /pw[_\-\s]*[:\=]?\s*(\w+)/i,
    /\b(\d{4})\b/  // Simple 4-digit fallback
  ];

  for (const pattern of passwordPatterns) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      console.log("Detected password from filename:", match[1]);
      return match[1];
    }
  }

  return null;
}

// Enhanced file info detection
export function detectFileInfoFromFilename(filename) {
  const fileInfo = detectFileInfo(filename);
  return {
    accountNumber: fileInfo.accountNumber,
    bankName: fileInfo.bankName,
    password: fileInfo.password
  };
}

// File info detection utility (implement based on your needs)
export function detectFileInfo(filename) {
  if (!filename) return { accountNumber: null, bankName: null, password: null };

  // Account number patterns
  const accountPatterns = [
    /acc(?:ount)?[_\-\s]*(?:no|number)?[_\-\s]*[:\=]?\s*(\d+)/i,
    /a\/c[_\-\s]*[:\=]?\s*(\d+)/i,
    /\b(\d{8,16})\b/, // General account number pattern
  ];
  // Bank name patterns
  const bankPatterns = [
    /equity/i,
    /kcb/i,
    /kenya\s+commercial\s+bank/i,
    /cooperative/i,
    /coop/i,
    /standard\s+chartered/i,
    /stanchart/i,
    /barclays/i,
    /absa/i,
    /dtb/i,
    /diamond\s+trust/i,
    /family/i,
    /ncba/i,
    /guaranty/i,
    /trust/i,
  ];

  let detectedAccountNumber = null;
  let detectedBankName = null;
  let detectedPassword = null;

  // Extract account number
  for (const pattern of accountPatterns) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      detectedAccountNumber = match[1];
      break;
    }
  }

  // Extract bank name
  for (const pattern of bankPatterns) {
    const match = filename.match(pattern);
    if (match) {
      detectedBankName = match[0];
      break;
    }
  }

  // Extract password using existing function
  detectedPassword = detectPasswordFromFilename(filename);

  return {
    accountNumber: detectedAccountNumber,
    bankName: detectedBankName,
    password: detectedPassword
  };
}

// Multi-month statement handling
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
        .eq('statement_month', month - 1) // Convert to 0-indexed
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
        statement_month: month - 1, // Convert to 0-indexed
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

// Enhanced bulk extraction processing - KEEPING ORIGINAL NAME
export async function processBulkExtraction(batchFiles, params, onProgress) {
  try {
    console.log(`Starting enhanced bulk extraction for ${batchFiles.length} files`);
    onProgress(0.1);

    const allResults = [];
    let processed = 0;

    // Process files individually with enhanced extraction
    for (const file of batchFiles) {
      try {
        onProgress(`Processing file ${processed + 1}/${batchFiles.length}: ${file.originalItem.file.name}`);

        // Create a unique file URL for each processing
        const fileUrl = URL.createObjectURL(file.originalItem.file);

        // Use enhanced extraction with all pages processing
        const extractionResult = await performBankStatementExtraction(
          fileUrl,
          {
            ...params,
            password: file.password
          },
          (message) => onProgress(`File ${processed + 1}: ${message}`)
        );

        if (extractionResult.success) {
          allResults.push({
            index: file.index,
            success: true,
            extractedData: extractionResult.extractedData,
            originalItem: file.originalItem
          });
        } else {
          allResults.push({
            index: file.index,
            success: false,
            error: extractionResult.message || 'Enhanced extraction failed',
            requiresPassword: extractionResult.requiresPassword || false,
            originalItem: file.originalItem
          });
        }

        // Clean up the URL
        URL.revokeObjectURL(fileUrl);

      } catch (error) {
        console.error(`Error processing document ${file.index}:`, error);
        allResults.push({
          index: file.index,
          success: false,
          error: `Processing failed: ${error.message}`,
          originalItem: file.originalItem
        });
      }

      processed++;
      onProgress(0.1 + 0.8 * (processed / batchFiles.length));
    }

    onProgress(1.0);

    const successful = allResults.filter(r => r.success).length;
    console.log(`Enhanced bulk extraction completed. ${successful}/${allResults.length} successful`);

    return allResults;

  } catch (error) {
    console.error('Error in enhanced bulk extraction:', error);
    return batchFiles.map(file => ({
      index: file.index,
      success: false,
      error: `Enhanced bulk extraction failed: ${error.message}`,
      originalItem: file.originalItem
    }));
  }
}

// Export all the utility functions - KEEPING ORIGINAL NAMES
export {
  createSafeDate,
  isValidDate,
  getMonthNumber,
  normalizeCurrencyCode,
  parseCurrencyAmount,
  generateTextEmbeddings,
  normalizeExtractedData,
  processExtraction,
  extractTextFromPdfPages,
  handleMultiMonthStatement,
  validateAndEnhanceExtraction,
  createEmptyExtractionData,
  extractTextFromAllPages,
  generateDocumentEmbeddings,
  processIntelligentExtraction
};