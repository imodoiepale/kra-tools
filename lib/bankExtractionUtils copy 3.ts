// @ts-nocheck
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import * as pdfjsLib from 'pdfjs-dist';
import { API_KEYS } from './apiKeys';
import { supabase } from "./supabase";
import { detectFileInfo } from '../app/payroll/bank-statements/utils/fileDetectionUtils';

// FIX: Critical line that resolves the "fake worker failed" error
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

function parseCurrencyAmount(amount) {
  if (amount === null || amount === undefined) return null;
  const amountStr = String(amount).replace(/[^\d.-]/g, '');
  const parsedAmount = parseFloat(amountStr);
  return isNaN(parsedAmount) ? null : parsedAmount;
}

// Enhanced PDF processing with password support
async function getPdfDocument(fileUrl, password = null) {
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

// Enhanced password detection from filename
export function detectPasswordFromFilename(filename: string): string | null {
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

// Enhanced file info detection using the utility
export function detectFileInfoFromFilename(filename: string): {
  accountNumber: string | null;
  bankName: string | null;
  password: string | null;
} {
  return detectFileInfo(filename);
}

// Enhanced password detection and application
export async function isPdfPasswordProtected(file: File): Promise<boolean> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer
    });

    try {
      await loadingTask.promise;
      return false; // If it loads without error, it's not password protected
    } catch (error) {
      if (error.name === 'PasswordException') {
        return true;
      }

      // Check if the error contains password-related messages
      const errorMessage = error.message || '';
      return errorMessage.includes('password') ||
        errorMessage.includes('encrypted') ||
        errorMessage.includes('protection');
    }
  } catch (error) {
    console.error('Error checking if PDF is password protected:', error);
    return true; // If we can't determine, assume it might be protected
  }
}

// Enhanced password application with validation
export async function applyPasswordToFiles(file: File, password: string): Promise<boolean> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      password: password
    });

    try {
      const pdf = await loadingTask.promise;
      // Try to access the first page to ensure the password works
      await pdf.getPage(1);
      pdf.destroy();
      console.log('Password successfully applied and verified');
      return true;
    } catch (error) {
      if (error.name === 'PasswordException') {
        console.log('Password failed:', password);
        return false;
      }
      throw error;
    }
  } catch (error) {
    console.error('Error applying password:', error);
    return false;
  }
}

// Enhanced text extraction with password support
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

// Enhanced main extraction function with automatic password detection
export async function performBankStatementExtraction(
  fileUrl,
  params,
  onProgress = (message) => console.log(message)
) {
  try {
    onProgress('Starting bank statement extraction...');

    // If fileUrl is a File object, try to detect password from filename
    let detectedPassword = null;
    if (fileUrl instanceof File) {
      const fileInfo = detectFileInfo(fileUrl.name);
      detectedPassword = fileInfo.password;
      if (detectedPassword) {
        console.log('Detected password from filename:', detectedPassword);
        onProgress(`Detected potential password from filename: ${detectedPassword}`);
      }
    }

    // Try extraction without password first
    let docResult = await getPdfDocument(fileUrl);

    // If password required and we have a detected password, try it
    if (!docResult.success && docResult.requiresPassword && detectedPassword) {
      onProgress('PDF is password protected, trying detected password...');
      docResult = await getPdfDocument(fileUrl, detectedPassword);

      if (docResult.success) {
        onProgress('Successfully unlocked PDF with detected password');
      }
    }

    // If still failed and we have params.password, try that
    if (!docResult.success && docResult.requiresPassword && params.password) {
      onProgress('Trying provided password...');
      docResult = await getPdfDocument(fileUrl, params.password);
    }

    if (!docResult.success) {
      return {
        success: false,
        message: docResult.error,
        requiresPassword: docResult.requiresPassword,
        extractedData: {
          bank_name: null, company_name: null, account_number: null, currency: null,
          statement_period: null, closing_balance: null, monthly_balances: []
        },
      };
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

// Enhanced bulk extraction with password handling
export async function processBulkExtraction(batchFiles, params, onProgress) {
  try {
    console.log(`Starting bulk extraction for ${batchFiles.length} files`);
    onProgress(0.1);

    const passwordProtectedFiles = [];
    const allResults = [];
    const documentTexts = [];

    // First pass: process all files and handle password detection
    for (const file of batchFiles) {
      try {
        let filePassword = file.password;

        // If no password provided, try to detect from filename
        if (!filePassword && file.originalItem?.file) {
          const fileInfo = detectFileInfo(file.originalItem.file.name);
          filePassword = fileInfo.password;
          if (filePassword) {
            console.log(`Detected password for ${file.originalItem.file.name}: ${filePassword}`);
          }
        }

        // Try to get PDF document
        let docResult = await getPdfDocument(file.fileUrl);

        // If password required, try detected or provided password
        if (!docResult.success && docResult.requiresPassword) {
          if (filePassword) {
            docResult = await getPdfDocument(file.fileUrl, filePassword);
          }

          if (!docResult.success) {
            passwordProtectedFiles.push({
              index: file.index,
              fileName: file.originalItem.file.name,
              fileObj: file,
              detectedPassword: filePassword
            });
            documentTexts.push(`----- DOCUMENT INDEX: ${file.index} -----\nPASSWORD PROTECTED\n----- END OF DOCUMENT${file.index} -----`);
            continue;
          }
        }

        if (!docResult.success) {
          throw new Error(docResult.error);
        }

        // Extract text from first and last pages
        const pdf = docResult.pdf;
        const totalPages = pdf.numPages;
        const pagesToProcess = [1];
        if (totalPages > 1) pagesToProcess.push(totalPages);

        const textResult = await extractTextFromPdfPages(pdf, pagesToProcess);
        pdf.destroy(); // Clean up PDF document

        if (!textResult.success) {
          throw new Error('Failed to extract text from PDF');
        }

        // Add document text with clear separation
        documentTexts.push(`
----- DOCUMENT INDEX: ${file.index} -----
FILENAME: ${file.originalItem.file.name}
PAGES EXAMINED: ${pagesToProcess.join(', ')} of ${totalPages}
EXPECTED MONTH/YEAR: ${params.month}/${params.year}
PASSWORD USED: ${filePassword || 'None'}

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

    // Process documents in chunks for API efficiency
    const MAX_CHUNK_SIZE = 8000; // Characters per chunk
    const textChunks = [];
    let currentChunk = "";

    for (const docText of documentTexts) {
      if (currentChunk.length + docText.length > MAX_CHUNK_SIZE) {
        if (currentChunk.length > 0) {
          textChunks.push(currentChunk);
        }
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
   1. Identify the document index you're analyzing
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
     If a document is password protected or has errors, still include its index with null values.
     `;

    // Process each chunk
    for (let i = 0; i < textChunks.length; i++) {
      try {
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

    // Update progress
    onProgress(1.0);

    // Return results with password-protected files if any
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

    // Extract each complete JSON object
    const jsonRegex = /\{\s*"document_index"\s*:\s*\d+[\s\S]*?\}/g;
    const jsonMatches = responseText.match(jsonRegex) || [];

    console.log(`Found ${jsonMatches.length} JSON objects`);

    // Process each JSON object
    for (const jsonStr of jsonMatches) {
      try {
        // Clean up JSON string
        let cleanJsonStr = jsonStr.trim();

        // Balance braces if needed
        const openBraces = (cleanJsonStr.match(/\{/g) || []).length;
        const closeBraces = (cleanJsonStr.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
          cleanJsonStr += "}".repeat(openBraces - closeBraces);
        }

        const parsedObj = JSON.parse(cleanJsonStr);

        // Skip if no document_index
        if (parsedObj.document_index === undefined) continue;

        // Find matching file
        const matchingFile = batchFiles.find(file => file.index === parseInt(parsedObj.document_index));

        if (matchingFile) {
          results.push({
            index: parsedObj.document_index,
            success: true,
            extractedData: normalizeExtractedData(parsedObj, matchingFile.params || { month: 0, year: 0 }),
            originalItem: matchingFile.originalItem
          });
        }
      } catch (jsonError) {
        console.error("Failed to parse JSON object:", jsonError);

        // Try to extract document_index for error reporting
        const indexMatch = jsonStr.match(/"document_index"\s*:\s*(\d+)/);
        if (indexMatch) {
          const docIndex = parseInt(indexMatch[1]);
          const matchingFile = batchFiles.find(file => file.index === docIndex);

          if (matchingFile) {
            results.push({
              index: docIndex,
              success: false,
              error: 'Failed to parse extraction results',
              originalItem: matchingFile.originalItem
            });
          }
        }
      }
    }

    // Add errors for any missing files
    for (const file of batchFiles) {
      if (!results.some(r => r.index === file.index)) {
        results.push({
          index: file.index,
          success: false,
          error: 'No extraction result found',
          originalItem: file.originalItem
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in parseExtractionResults:', error);
    return batchFiles.map(file => ({
      index: file.index,
      success: false,
      error: `Extraction failed: ${error.message}`,
      originalItem: file.originalItem
    }));
  }
}

// Enhanced statement period parsing
export function parseStatementPeriod(periodString: string) {
  if (!periodString) return null;

  console.log('Parsing period string:', periodString);

  const normalizedPeriod = periodString.trim().replace(/\s+/g, ' ');

  // Pattern 1: Date range format "01/01/2024 - 30/07/2024"
  const dateRangePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–—]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const dateRangeMatch = normalizedPeriod.match(dateRangePattern);

  if (dateRangeMatch) {
    const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = dateRangeMatch;

    return {
      startMonth: parseInt(startMonth),
      startYear: parseInt(startYear),
      endMonth: parseInt(endMonth),
      endYear: parseInt(endYear)
    };
  }

  // Pattern 2: Month name format "January 2024"
  const singleMonthMatch = normalizedPeriod.match(/^(\w+)\s+(\d{4})$/i);
  if (singleMonthMatch) {
    const monthName = singleMonthMatch[1].toLowerCase();
    const year = parseInt(singleMonthMatch[2]);

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

  // Pattern 3: Month range same year "January - March 2024"
  const sameYearMatch = normalizedPeriod.match(/(\w+)\s*(?:[-–—]|to)\s*(\w+)\s+(\d{4})/i);
  if (sameYearMatch) {
    const startMonthName = sameYearMatch[1].toLowerCase();
    const endMonthName = sameYearMatch[2].toLowerCase();
    const year = parseInt(sameYearMatch[3]);

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

  console.warn('Could not parse statement period:', periodString);
  return null;
}

function getMonthNumber(monthName: string): number | null {
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

  const fullIndex = fullMonths.indexOf(monthLower);
  if (fullIndex !== -1) {
    return fullIndex + 1;
  }

  const abbrevIndex = abbrevMonths.indexOf(monthLower);
  if (abbrevIndex !== -1) {
    return abbrevIndex + 1;
  }

  if (monthLower.length >= 3) {
    for (let i = 0; i < fullMonths.length; i++) {
      if (fullMonths[i].startsWith(monthLower)) {
        return i + 1;
      }
    }
  }

  return null;
}

// Enhanced month range generation
export function generateMonthRange(startMonth, startYear, endMonth, endYear) {
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

// Enhanced statement cycle management
export const getOrCreateStatementCycle = async (year: number, month: number): Promise<string> => {
  try {
    const monthStr = (month + 1).toString().padStart(2, '0');
    const monthYearStr = `${year}-${monthStr}`;

    console.log('Creating/finding statement cycle for:', { year, month, monthYearStr });

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

// Enhanced validation utilities
export function validateStatementPeriodRange(extractedPeriod: string, selectedMonth: number, selectedYear: number) {
  if (!extractedPeriod) {
    return { isValid: false, message: 'No statement period found' };
  }

  const periodDates = parseStatementPeriod(extractedPeriod);
  if (!periodDates) {
    return { isValid: false, message: 'Could not parse statement period' };
  }

  const { startMonth, startYear, endMonth, endYear } = periodDates;
  const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

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

// Enhanced bank matching with file info
export function fuzzyMatchBankWithFileInfo(filename: string, extractedData: any, allBanks: any[]) {
  console.log('Enhanced bank matching for:', filename);

  if (!allBanks || allBanks.length === 0) {
    return null;
  }

  // Get file detection info
  const fileInfo = detectFileInfo(filename);
  console.log('File detection results:', fileInfo);

  let bestMatch = null;
  let bestScore = 0;

  for (const bank of allBanks) {
    let score = 0;
    let matchReasons = [];

    // File-based matching (higher weight)
    if (fileInfo.accountNumber && bank.account_number) {
      if (bank.account_number.includes(fileInfo.accountNumber) ||
        fileInfo.accountNumber.includes(bank.account_number)) {
        score += 40;
        matchReasons.push("Filename account match");
      }
    }

    if (fileInfo.bankName && bank.bank_name) {
      if (bank.bank_name.toLowerCase().includes(fileInfo.bankName.toLowerCase()) ||
        fileInfo.bankName.toLowerCase().includes(bank.bank_name.toLowerCase())) {
        score += 30;
        matchReasons.push("Filename bank match");
      }
    }

    if (fileInfo.password && bank.acc_password) {
      if (fileInfo.password === bank.acc_password) {
        score += 20;
        matchReasons.push("Password match");
      }
    }

    // Extracted data matching (lower weight)
    if (extractedData?.account_number && bank.account_number) {
      if (bank.account_number.includes(extractedData.account_number) ||
        extractedData.account_number.includes(bank.account_number)) {
        score += 25;
        matchReasons.push("Extracted account match");
      }
    }

    if (extractedData?.bank_name && bank.bank_name) {
      if (bank.bank_name.toLowerCase().includes(extractedData.bank_name.toLowerCase()) ||
        extractedData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())) {
        score += 15;
        matchReasons.push("Extracted bank match");
      }
    }

    if (extractedData?.company_name && bank.company_name) {
      if (bank.company_name.toLowerCase().includes(extractedData.company_name.toLowerCase()) ||
        extractedData.company_name.toLowerCase().includes(bank.company_name.toLowerCase())) {
        score += 10;
        matchReasons.push("Company match");
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { bank, score, reasons: matchReasons };
    }
  }

  if (bestScore >= 15) { // Lower threshold due to enhanced matching
    console.log(`Enhanced match found with score ${bestScore}:`, bestMatch.bank.company_name, bestMatch.reasons);
    return bestMatch.bank;
  }

  console.log("No enhanced match found with sufficient confidence");
  return null;
}

// Export all necessary functions
export {
  normalizeCurrencyCode,
  parseCurrencyAmount,
  generateTextEmbeddings,
  normalizeExtractedData,
  processExtraction,
  extractTextFromPdfPages,
  getPdfDocument
};