// @ts-nocheck
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import * as pdfjsLib from 'pdfjs-dist';
import { API_KEYS } from '@/lib/apiKeys';
import { supabase } from "@/lib/supabase";

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

// Main extraction function with enhanced error handling
async function performBankStatementExtraction(fileUrl, params, onProgress = (message) => console.log(message)) {
  try {
    onProgress('Starting bank statement extraction...');
    const docResult = await getPdfDocument(fileUrl, params.password);
    if (!docResult.success) {
      if (docResult.requiresPassword) {
        return {
          success: false,
          requiresPassword: true,
          message: docResult.error,
          extractedData: {
            bank_name: null, company_name: null, account_number: null, currency: null,
            statement_period: null, closing_balance: null, monthly_balances: []
          }
        };
      }
      throw new Error(docResult.error);
    }
    const pdf = docResult.pdf;

    onProgress(`Detected ${pdf.numPages} pages in document`);
    const pages = new Set([1]);
    if (pdf.numPages > 1) pages.add(pdf.numPages);

    onProgress(`Extracting text from pages ${Array.from(pages).join(', ')}...`);
    const textResult = await extractTextFromPdfPages(pdf, Array.from(pages));
    if (!textResult.success) {
      throw new Error(textResult.error);
    }

    const extractedData = await processExtraction(textResult.textByPage, params, onProgress);

    const mainClosingBalance = extractedData.monthly_balances?.find(b =>
      b.month === (params.month + 1) && b.year === params.year
    )?.closing_balance;

    const finalData = {
      ...extractedData,
      closing_balance: mainClosingBalance !== undefined ? mainClosingBalance : null,
    };

    onProgress('Extraction completed successfully');
    return { success: true, extractedData: finalData };

  } catch (error) {
    console.error('Error in bank statement extraction:', error);
    return {
      success: false,
      message: error.message,
      extractedData: {
        bank_name: null, company_name: null, account_number: null, currency: null,
        statement_period: null, closing_balance: null, monthly_balances: []
      },
    };
  }
}

// Enhanced statement cycle creation
 const getOrCreateStatementCycle = async (year, month) => {
  try {
    // month should be 0-indexed (0=January, 1=February, etc.)
    const monthStr = (month + 1).toString().padStart(2, '0'); // Convert to 1-indexed and pad
    const monthYearStr = `${year}-${monthStr}`;

    console.log('Creating/finding statement cycle for:', { year, month, monthYearStr });

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
      month
    });
    throw error;
  }
};

// Enhanced utility for creating statement cycles for a period
 async function createStatementCyclesForPeriod(statementPeriod) {
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
 function validateStatementPeriodRange(extractedPeriod, selectedMonth, selectedYear) {
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
 function detectPasswordFromFilename(filename) {
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
 function detectFileInfoFromFilename(filename) {
  const fileInfo = detectFileInfo(filename);
  return {
    accountNumber: fileInfo.accountNumber,
    bankName: fileInfo.bankName,
    password: fileInfo.password
  };
}

// File info detection utility (implement based on your needs)
 function detectFileInfo(filename) {
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

// Enhanced bulk extraction processing
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
        if (totalPages > 1) pagesToProcess.push(totalPages);

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

        // Use extraction API with the extractionModel
        const extractionResult = await extractionModel.generateContent([extractionPrompt, textChunks[i]]);
        const responseText = extractionResult.response.text();

        // Parse results
        const chunkResults = parseExtractionResults(responseText, batchFiles);
        allResults.push(...chunkResults);

        // Update progress
        onProgress(0.5 + 0.4 * ((i + 1) / textChunks.length));
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
      }
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

// Enhanced extraction results parsing
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

    // Process each potential JSON object
    for (let i = 0; i < potentialJsonMatches.length; i++) {
      const jsonStr = potentialJsonMatches[i];

      try {
        // Try to clean up any invalid JSON
        let jsonText = jsonStr.trim();

        // Handle malformed JSON with missing closing braces
        const openBraces = (jsonText.match(/\{/g) || []).length;
        const closeBraces = (jsonText.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
          const missing = openBraces - closeBraces;
          jsonText = jsonText + "}".repeat(missing);
        }

        // Parse the JSON object
        const parsedObj = JSON.parse(jsonText);

        // Skip if no document_index
        if (parsedObj.document_index === undefined) continue;

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
        }
      } catch (jsonError) {
        console.error("Failed to parse JSON object:", jsonError);
        console.log("Problematic JSON:", jsonStr.substring(0, 100) + "...");

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

    // Fallback to return error results for all files
    return batchFiles.map(file => ({
      index: file.index,
      success: false,
      error: `Extraction failed: ${error.message}`,
      originalItem: file.originalItem
    }));
  }
}

// JSON repair utility
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

// PDF page count utility
async function getPdfPageCount(fileUrl, password = null) {
  try {
    const docResult = await getPdfDocument(fileUrl, password);
    if (!docResult.success) {
      return docResult;
    }
    return { success: true, numPages: docResult.pdf.numPages };
  } catch (error) {
    console.error('Error getting PDF page count:', error);
    return { success: false, error: error.message };
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
        const originalIndex = files.find(f => f.index === documentIndex)?.index || i;

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

// Validation helper function
function validateParsedPeriod(result) {
  if (!result) return null;

  const { startMonth, startYear, endMonth, endYear } = result;

  // Basic validation
  if (!startMonth || !startYear || !endMonth || !endYear) return null;
  if (startMonth < 1 || startMonth > 12) return null;
  if (endMonth < 1 || endMonth > 12) return null;
  if (startYear < 1900 || endYear < 1900) return null;

  // Ensure end date is not before start date
  const startDate = new Date(startYear, startMonth - 1);
  const endDate = new Date(endYear, endMonth - 1);

  if (endDate < startDate) {
    console.warn('End date is before start date, swapping...');
    return {
      startMonth: endMonth,
      startYear: endYear,
      endMonth: startMonth,
      endYear: startYear
    };
  }

  return result;
}

// Export all the utility functions
export {
  createSafeDate,
  isValidDate,
  getMonthNumber,
  normalizeCurrencyCode,
  parseCurrencyAmount,
  normalizeExtractedData,
  processExtraction,
  performBankStatementExtraction,
  extractTextFromPdfPages,
  handleMultiMonthStatement,
  batchExtractDocuments,
  validateParsedPeriod,
  parseExtractionResults,
  repairJsonString,
  getPdfPageCount,
  getOrCreateStatementCycle,
  createStatementCyclesForPeriod,
  validateStatementPeriodRange,
  detectPasswordFromFilename,
  detectFileInfo
};