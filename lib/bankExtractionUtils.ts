// @ts-nocheck
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import * as pdfjsLib from 'pdfjs-dist';
// import * as qpdf from 'node-qpdf';
import { API_KEYS } from './apiKeys';
// import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

// Constants
const EMBEDDING_MODEL = "gemini-embedding-exp-03-07";
const EXTRACTION_MODEL = "gemini-2.0-flash";
const RATE_LIMIT_COOLDOWN = 60000; // 1 minute cooldown
const MAX_FAILURES = 5; // Max consecutive failures before cooling down
const MAX_KEY_RETRIES = 3; // Max retries with different keys

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

// Helper to normalize currency codes
function normalizeCurrencyCode(currency) {
  if (!currency) return 'KES'; // Default for Kenyan statements
  
  const code = String(currency).toUpperCase().trim();
  
  // Map of common currency indicators to standard codes
  const currencyMap = {
    'KSH': 'KES',
    'KSHS': 'KES',
    'KENYA SHILLING': 'KES',
    'KENYAN SHILLING': 'KES',
    'SHILLING': 'KES',
    'USD': 'USD',
    'US DOLLAR': 'USD',
    'DOLLAR': 'USD',
    'GBP': 'GBP',
    'POUND': 'GBP',
    'BRITISH POUND': 'GBP',
    'EUR': 'EUR',
    'EURO': 'EUR'
  };
  
  return currencyMap[code] || code;
}

// Helper function to parse currency amounts
function parseCurrencyAmount(amount) {
  if (amount === null || amount === undefined) return null;
  
  // If already a number, return as is
  if (typeof amount === 'number') return amount;
  
  // Convert to string and clean
  const cleanAmount = String(amount)
    .replace(/[^\d.\-,]/g, '') // Remove all except digits, dots, minus, commas
    .replace(/,/g, '.') // Convert commas to dots 
    .replace(/\.(?=.*\.)/g, ''); // Keep only the last decimal point
  
  const value = parseFloat(cleanAmount);
  return isNaN(value) ? null : value;
}

// Helper function to normalize text values
function normalizeText(text) {
  if (!text) return null;
  
  // Convert to string if not already
  text = String(text);
  
  // Remove extra spaces, normalize case
  text = text.trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/^[^a-zA-Z0-9]*/, '') // Remove leading non-alphanumeric chars
    .replace(/[^a-zA-Z0-9]*$/, ''); // Remove trailing non-alphanumeric chars
  
  // Check if it's a placeholder or empty after cleaning
  if (!text || text.toLowerCase() === 'not available' || text.toLowerCase() === 'unknown') {
    return null;
  }
  
  return text;
}

// Helper to normalize bank names
function normalizeBankName(bankName) {
  if (!bankName) return null;
  
  const name = bankName.toString().trim().toUpperCase();
  
  // Common bank name mappings in Kenya
  const bankMappings = {
    'EQUITY': 'EQUITY BANK',
    'EQUITY BANK': 'EQUITY BANK',
    'EQUITY BANK KENYA': 'EQUITY BANK',
    'KCB': 'KCB BANK',
    'KCB BANK': 'KCB BANK',
    'KENYA COMMERCIAL BANK': 'KCB BANK',
    'CO-OP': 'CO-OPERATIVE BANK',
    'COOP': 'CO-OPERATIVE BANK',
    'CO-OPERATIVE': 'CO-OPERATIVE BANK',
    'CO-OPERATIVE BANK': 'CO-OPERATIVE BANK',
    'COOPERATIVE BANK': 'CO-OPERATIVE BANK',
    'ABSA': 'ABSA BANK',
    'ABSA BANK': 'ABSA BANK',
    'BARCLAYS': 'ABSA BANK',
    'BARCLAYS BANK': 'ABSA BANK',
    'STANCHART': 'STANDARD CHARTERED',
    'STANDARD CHARTERED': 'STANDARD CHARTERED',
    'I&M': 'I&M BANK',
    'I&M BANK': 'I&M BANK',
    'I AND M': 'I&M BANK',
    'NCBA': 'NCBA BANK',
    'NCBA BANK': 'NCBA BANK',
    'DIAMOND TRUST': 'DIAMOND TRUST BANK',
    'DTB': 'DIAMOND TRUST BANK',
    'DIAMOND TRUST BANK': 'DIAMOND TRUST BANK',
    'FAMILY': 'FAMILY BANK',
    'FAMILY BANK': 'FAMILY BANK'
  };
  
  // Check for direct match
  if (bankMappings[name]) {
    return bankMappings[name];
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(bankMappings)) {
    if (name.includes(key)) {
      return value;
    }
  }
  
  // If no mapping found, return original with proper capitalization
  return bankName.toString().trim().replace(/\b\w/g, l => l.toUpperCase());
}

// Enhanced function to process extraction results and normalize the data
function processExtractionResults(results, file, params) {
  if (!results || !results.extractedData) {
    return {
      originalItem: file.originalItem,
      success: false,
      error: "No valid extraction data found",
      extractedData: null
    };
  }
  
  try {
    const data = results.extractedData;
    
    // Normalize bank name
    const bankName = normalizeBankName(data.bank_name);
    
    // Normalize currency
    const currency = data.currency ? normalizeCurrencyCode(data.currency) : 'KES';
    
    // Try to extract account number from filename if not found in extraction
    let accountNumber = data.account_number;
    if (!accountNumber && file.originalItem && file.originalItem.file && file.originalItem.file.name) {
      const filename = file.originalItem.file.name;
      const accountMatch = filename.match(/(\d{5,})/);
      if (accountMatch) {
        accountNumber = accountMatch[1];
      }
    }
    
    // Ensure we have a valid monthly_balances array
    let monthlyBalances = Array.isArray(data.monthly_balances) ? data.monthly_balances : [];
    
    // If no monthly balances but we have a closing balance, create one
    if (monthlyBalances.length === 0 && data.closing_balance !== undefined) {
      monthlyBalances = [{
        month: params.month,
        year: params.year,
        closing_balance: typeof data.closing_balance === 'number' ? data.closing_balance : parseCurrencyAmount(data.closing_balance),
        statement_page: 1,
        is_verified: false
      }];
    }
    
    // Ensure all numeric values are properly parsed
    monthlyBalances = monthlyBalances.map(balance => ({
      month: balance.month || params.month,
      year: balance.year || params.year,
      closing_balance: typeof balance.closing_balance === 'number' ? balance.closing_balance : parseCurrencyAmount(balance.closing_balance),
      statement_page: balance.statement_page || 1,
      is_verified: balance.is_verified || false,
      verified_by: balance.verified_by || null,
      verified_at: balance.verified_at || null,
      highlight_coordinates: balance.highlight_coordinates || null
    }));
    
    // Create the normalized extraction result
    const normalizedData = {
      bank_name: bankName,
      account_number: accountNumber || null,
      company_name: file.originalItem.companyName || data.company_name || null,
      currency: currency,
      statement_period: data.statement_period || `${params.month}/${params.year}`,
      closing_balance: typeof data.closing_balance === 'number' ? data.closing_balance : parseCurrencyAmount(data.closing_balance),
      monthly_balances: monthlyBalances
    };
    
    return {
      originalItem: file.originalItem,
      success: true,
      extractedData: normalizedData
    };
  } catch (error) {
    console.error("Error normalizing extraction results:", error);
    return {
      originalItem: file.originalItem,
      success: false,
      error: "Failed to normalize extraction results: " + error.message,
      extractedData: null
    };
  }
}

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
  let lastError = null;
  
  // Try multiple API keys if needed
  for (let attempt = 0; attempt < MAX_KEY_RETRIES; attempt++) {
    try {
      // Get a fresh API key for this attempt
      const currentKey = API_KEYS[currentApiKeyIndex];
      const status = apiKeyStatus.get(currentKey);
      
      // Check if current key is in cooldown
      if (status && Date.now() < status.cooldownUntil) {
        console.log(`API key ${currentApiKeyIndex + 1}/${API_KEYS.length} in cooldown until ${new Date(status.cooldownUntil).toLocaleString()}`);
        // Move to next key
        currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;
        continue;
      }
      
      console.log(`Attempt ${attempt + 1}/${MAX_KEY_RETRIES}: Using API key ${currentApiKeyIndex + 1}/${API_KEYS.length}`);
      
      const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
      const result = await embeddingModel.embedContent(textContent);
      const embedding = result.embedding;
      
      // Reset failure count on success
      if (status) {
        status.failureCount = 0;
        status.lastUsed = Date.now();
        apiKeyStatus.set(currentKey, status);
      }
      
      return embedding.values;
    } catch (error) {
      lastError = error;
      const currentKey = API_KEYS[currentApiKeyIndex];
      console.error(`Error generating embeddings (attempt ${attempt + 1}/${MAX_KEY_RETRIES}):`, error.message);
      
      // Mark the current key as having a failure
      const status = apiKeyStatus.get(currentKey) || {
        lastUsed: 0,
        failureCount: 0,
        cooldownUntil: 0
      };
      
      status.failureCount++;
      status.lastUsed = Date.now();
      
      // If we've hit rate limits, put this key in cooldown
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('exhausted')) {
        // Exponential backoff for cooldown: 1min, 2min, 4min, 8min, etc.
        const cooldownMinutes = Math.min(15, Math.pow(2, status.failureCount - 1));
        status.cooldownUntil = Date.now() + (cooldownMinutes * 60000);
        console.log(`API key put in cooldown until ${new Date(status.cooldownUntil).toLocaleString()} (${cooldownMinutes} minutes)`);
      }
      
      apiKeyStatus.set(currentKey, status);
      
      // Rotate to next API key
      currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;
      genAI = new GoogleGenerativeAI(API_KEYS[currentApiKeyIndex]);
      
      // Wait a moment before retrying
      await delay(1000);
    }
  }
  
  // If we get here, all retries failed
  throw lastError || new Error("Failed to generate embeddings after multiple attempts");
}

// Create extraction queries for the embedding
function createExtractionQueries() {
  return [
    { field: 'bank_name', query: "What is the name of the bank?" },
    { field: 'account_number', query: "What is the account number?" },
    { field: 'company_name', query: "What is the name of the company or account holder?" },
    { field: 'currency', query: "What currency is used in this statement?" },
    { field: 'statement_period', query: "What is the statement period? Include start and end dates." },
    { field: 'closing_balance', query: "What is the closing balance of the account?" },
    { field: 'monthly_balances', query: "List all monthly balances including month, year, opening and closing balances." }
  ];
}

// Process extraction using embeddings
async function processExtraction(pageTextContent, params, onProgress, supabase) {
  try {
    onProgress("Generating embeddings for bank statement pages...");
    
    // Handle case where pageTextContent might not be properly structured
    let allTextContent = '';
    
    // If we received an object with textByPage property (new format)
    if (pageTextContent && typeof pageTextContent === 'object') {
      if (pageTextContent.textByPage) {
        // Use textByPage property
        Object.values(pageTextContent.textByPage).forEach(text => {
          allTextContent += text + '\n\n';
        });
      } else {
        // Try direct object values if no textByPage
        Object.values(pageTextContent).forEach(text => {
          if (typeof text === 'string') {
            allTextContent += text + '\n\n';
          }
        });
      }
    } else if (typeof pageTextContent === 'string') {
      // If we just got a string, use it directly
      allTextContent = pageTextContent;
    } else {
      // Fallback for empty or invalid input
      console.error("Invalid pageTextContent format:", typeof pageTextContent);
      return {
        success: false,
        error: "Invalid text content format",
        extractedData: null
      };
    }
    
    console.log("Page text content length:", JSON.stringify(pageTextContent).length);
    console.log("First 2000 chars of content:", JSON.stringify(pageTextContent).substring(0, 2000));
    
    // Check if we have any content to process
    if (!allTextContent || allTextContent.trim().length < 100) {
      console.error("Insufficient text content for extraction:", allTextContent?.substring(0, 1000) || "empty");
      return {
        success: false,
        error: "Insufficient text content for extraction",
        extractedData: {
          bank_name: null,
          account_number: null,
          currency: null,
          statement_period: null,
          closing_balance: null
        }
      };
    }
    
    // Generate embeddings from text content
    let embeddings;
    try {
      embeddings = await generateTextEmbeddings(allTextContent);
    } catch (error) {
      console.error("Error generating embeddings:", error);
      
      // Fall back to direct extraction without embeddings
      return extractFallbackData(allTextContent, params);
    }
    
    // Continue with the rest of the extraction process as before...
    onProgress("Running extraction queries against embeddings...");
    
    // Create a custom extraction prompt
    const extractionPrompt = `
You are analyzing a bank statement. Extract the following information from the text:

1. Bank Name: The official name of the bank from the document and also identify from Logos available in the document
2. Account Number: The full account number 
3. Company Name: The name of the account holder
4. Currency: The currency code or name used in the statement
5. Statement Period: The exact date range covered in dd/mm/yyyy format always
6. Closing Balance: The final balance
7. Monthly Balances: Any balances for specific months mentioned

For the specific month ${params.month}/${params.year}, find exact opening and closing balances if available.

Return your analysis in this JSON format:
{
  "bank_name": "Bank Name",
  "account_number": "Account Number",
  "company_name": "Company Name",
  "currency": "Currency Code",
  "statement_period": "Start Date - End Date",
  "closing_balance": number,
  "monthly_balances": [
    {
      "month": month_number,
      "year": year_number,
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
      allTextContent
    ]);

    const responseText = result.response.text();

    console.log("API Response first 3000 chars:", responseText.substring(0, 3000));

    // Parse and validate the extracted data
    onProgress("Processing extracted information...");
    
    let extractedData;
    try {
      // First attempt: Try to find a JSON object in the response with multiple regex patterns
      // Try multiple regex patterns to handle different AI response formats
      const jsonPatterns = [
        /```json\s*(\{[\s\S]*?\})\s*```/, // Code block with json tag
        /```\s*(\{[\s\S]*?\})\s*```/,      // Code block without json tag
        /\{[\s\S]*"monthly_balances"\s*:\s*\[[\s\S]*?\]\s*\}/, // Direct JSON with monthly_balances
        /\{[\s\S]*"bank_name"[\s\S]*"account_number"[\s\S]*\}/, // Direct JSON with key fields
        /\{[\s\S]*?\}/ // Any JSON object as a last resort
      ];
      
      let jsonContent = null;
      let matchedPattern = null;
      
      // Try each pattern in order until we find a match
      for (const pattern of jsonPatterns) {
        const match = responseText.match(pattern);
        if (match) {
          jsonContent = match[1] || match[0]; // Use group 1 if it exists (for code blocks)
          matchedPattern = pattern.toString();
          break;
        }
      }
      
      console.log("JSON extraction result:", { 
        found: !!jsonContent,
        matchedPattern,
        contentLength: jsonContent?.length || 0,
        contentPreview: jsonContent?.substring(0, 100)
      });
      
      if (jsonContent) {
        try {
          // Try to parse the matched JSON
          extractedData = JSON.parse(jsonContent);
          console.log("Successfully parsed JSON with keys:", Object.keys(extractedData));
        } catch (parseError) {
          console.log("JSON parse error:", parseError);
          
          // If direct parsing fails, try to repair the JSON
          console.log("Attempting to repair JSON...");
          const repairResult = repairJsonString(jsonContent);
          
          if (repairResult.success) {
            console.log("JSON repair successful");
            extractedData = repairResult.json;
          } else {
            console.log("JSON repair failed:", repairResult.error);
            
            // Try a more aggressive approach to find any JSON-like structure
            console.log("Trying aggressive JSON extraction...");
            const potentialJson = responseText.replace(/[\s\S]*?(\{[\s\S]*\})[\s\S]*/, '$1');
            const secondRepairResult = repairJsonString(potentialJson);
            
            if (secondRepairResult.success) {
              console.log("Aggressive JSON repair successful");
              extractedData = secondRepairResult.json;
            } else {
              console.log("All JSON extraction attempts failed");
              // Last resort: try to extract key parts manually
              extractedData = extractFallbackData(responseText, params);
            }
          }
        }
      } else {
        console.log("No JSON structure found in response, trying fallback extraction");
        // No JSON structure found, attempt fallback extraction
        extractedData = extractFallbackData(responseText, params);
      }
    } catch (jsonError) {
      console.error("Error parsing extraction result:", jsonError);
      throw new Error("Failed to parse extraction results");
    }

    // Return the normalized data
    const normalizedData = await normalizeExtractedData(extractedData, params, supabase);
    
    // Log normalized data for debugging
    console.log("Returning normalized data:", JSON.stringify({
      bank_name: normalizedData.bank_name,
      account_number: normalizedData.account_number,
      company_name: normalizedData.company_name,
      statement_period: normalizedData.statement_period,
    }));
    
    return {
      success: true,
      extractedData: normalizedData
    };
  } catch (error) {
    console.error("Error in extraction process:", error);
    throw error;
  }
}

// Main extraction function
export async function performBankStatementExtraction(
  fileUrl,
  params,
  onProgress = (message) => console.log(message),
  supabase = null
) {
  try {
    // Reset count at beginning of a new extraction
    let consecutiveErrors = 0;
    
    onProgress("Analyzing document content...");
    
    // Get page count to determine processing strategy
    const pageCountResult = await getPdfPageCount(fileUrl, params.password);
    
    // Check if we got a valid result object with numPages
    if (!pageCountResult || !pageCountResult.success) {
      const errorMessage = pageCountResult?.error || 'Failed to get page count';
      onProgress(`Error: ${errorMessage}`);
      
      // Check if password protected
      if (pageCountResult?.requiresPassword) {
        return {
          success: false,
          requiresPassword: true,
          passwordNeeded: pageCountResult.passwordNeeded,
          message: 'This PDF is password protected. Please provide a password.'
        };
      }
      
      throw new Error(errorMessage);
    }
    
    // Extract the actual page count from the result object
    const pageCount = pageCountResult.numPages;
    onProgress(`Detected ${pageCount} pages in document`);
    
    // For large documents, sample pages instead of processing all
    // This reduces API calls and prevents rate limiting
    let pagesToProcess = [];
    if (pageCount > 100) {
      // For very large documents, sample strategically 
      // with more focus on the beginning and end where summary data often appears
      pagesToProcess = [1, 2, 3, 4, 5, 
                        Math.ceil(pageCount * 0.25), 
                        Math.ceil(pageCount * 0.5),
                        Math.ceil(pageCount * 0.75),
                        pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
    } else if (pageCount > 50) {
      // For large documents (50-100 pages), sample beginning, quarter points, and end
      pagesToProcess = [1, 2, 3, 
                       Math.ceil(pageCount * 0.25), 
                       Math.ceil(pageCount * 0.5),
                       Math.ceil(pageCount * 0.75),
                       pageCount - 2, pageCount - 1, pageCount];
    } else if (pageCount > 20) {
      // For medium-sized documents, sample at regular intervals
      pagesToProcess = [1, 2, pageCount - 1, pageCount];
      const interval = Math.ceil(pageCount / 8); // ~8 samples throughout
      for (let i = interval; i < pageCount - interval; i += interval) {
        pagesToProcess.push(i);
      }
    } else if (pageCount > 5) {
      // For smaller documents (5-20 pages), sample first, last, and several in between
      pagesToProcess = [1, 2, Math.ceil(pageCount / 2), pageCount - 1, pageCount];
    } else {
      // For very small documents, process all pages
      pagesToProcess = Array.from({length: pageCount}, (_, i) => i + 1);
    }
    
    // Sort page numbers and remove duplicates
    pagesToProcess = [...new Set(pagesToProcess)].sort((a, b) => a - b);

    // Apply an upper limit to avoid processing too many pages for very large documents
    if (pagesToProcess.length > 20) {
      // If we have too many pages, select a representative sample
      const maxPages = 20;
      const step = Math.ceil(pagesToProcess.length / maxPages);
      pagesToProcess = pagesToProcess.filter((_, index) => index % step === 0);
      
      // Always ensure first and last pages are included
      if (!pagesToProcess.includes(1)) pagesToProcess.unshift(1);
      if (!pagesToProcess.includes(pageCount)) pagesToProcess.push(pageCount);
      
      pagesToProcess.sort((a, b) => a - b);
    }
    
    // Extract text from PDF pages
    const pageTextContent = await extractTextFromPdfPages(fileUrl, pagesToProcess, params.password);

    // Validate we got actual text content
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
      
      // Return partial result instead of failing completely
      return {
        success: true,
        extractedData: {
          bank_name: null,
          account_number: null,
          currency: null,
          statement_period: null,
          closing_balance: null,
          monthly_balances: []
        },
        rawData: null,
        partial: true,
        message: `Text extraction failed: ${errorMessage}`
      };
    }

    // Process the extracted text using the textByPage property
    const textByPageData = pageTextContent.textByPage || {};

    // Process the extracted text in batches to reduce API load
    onProgress("Processing extracted information...");
    const extractionResult = await processExtraction(textByPageData, params, onProgress, supabase);

    // Enhanced error handling for extraction results
    if (!extractionResult || !extractionResult.extractedData) {
      const errorDetails = {
        resultExists: !!extractionResult,
        extractedDataExists: !!extractionResult?.extractedData,
        resultType: typeof extractionResult,
        extractedDataType: typeof extractionResult?.extractedData,
        resultKeys: extractionResult ? Object.keys(extractionResult) : [],
        rawResult: JSON.stringify(extractionResult).substring(0, 500)
      };
      
      console.error("Extraction failure details:", errorDetails);
      onProgress(`Extraction did not return valid results: ${JSON.stringify(errorDetails)}`);
      
      // Instead of failing completely, return a partial success with empty data
      return {
        success: true,
        extractedData: {
          bank_name: null,
          account_number: null,
          currency: null,
          statement_period: null,
          closing_balance: null,
          monthly_balances: [{
            month: params.month || 0,
            year: params.year || 0,
            closing_balance: null,
            statement_page: 1,
            is_verified: false
          }]
        },
        rawData: pageTextContent,
        partial: true, // Indicate this is a partial result
        message: `Extraction could not process this document fully. Error details: ${JSON.stringify(errorDetails)}`
      };
    }

    // Log the successful extraction data
    console.log("Extraction completed successfully with data:", JSON.stringify({
      bank_name: extractionResult.extractedData.bank_name,
      account_number: extractionResult.extractedData.account_number,
      statement_period: extractionResult.extractedData.statement_period,
      monthly_balances_count: extractionResult.extractedData.monthly_balances?.length || 0
    }, null, 2));

    onProgress("Extraction completed successfully");
    
    // Important: Return a DEEP COPY of the extracted data to prevent reference issues
    return {
      success: true,
      extractedData: JSON.parse(JSON.stringify(extractionResult.extractedData)),
      rawData: pageTextContent
    };
  } catch (error) {
    onProgress(`Error in bank statement extraction: ${error.message}`);
    return {
      success: false,
      error: error.message,
      errorDetails: error.toString()
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
        closing_balance: null,
        statement_page: 1,
        is_verified: false
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

export async function processBulkExtraction(batchFiles, params, onProgress, supabase = null) {
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

        // Extract text from key pages based on document size
        const totalPages = pageCountResult.numPages;
        let pagesToProcess = [1];
        
        // Enhanced adaptive sampling strategy for different document sizes
        if (totalPages > 100) {
          // For very large documents (100+ pages), sample strategically 
          // with more focus on the beginning and end where summary data often appears
          pagesToProcess = [1, 2, 3, 4, 5, 
                            Math.ceil(totalPages * 0.25), 
                            Math.ceil(totalPages * 0.5),
                            Math.ceil(totalPages * 0.75),
                            totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else if (totalPages > 50) {
          // For large documents (50-100 pages), sample beginning, quarter points, and end
          pagesToProcess = [1, 2, 3, 
                           Math.ceil(totalPages * 0.25), 
                           Math.ceil(totalPages * 0.5),
                           Math.ceil(totalPages * 0.75),
                           totalPages - 2, totalPages - 1, totalPages];
        } else if (totalPages > 20) {
          // For medium documents (20-50 pages), sample at regular intervals
          pagesToProcess = [1, 2, totalPages - 1, totalPages];
          const interval = Math.ceil(totalPages / 8); // ~8 samples throughout
          for (let i = interval; i < totalPages - interval; i += interval) {
            pagesToProcess.push(i);
          }
        } else if (totalPages > 5) {
          // For smaller documents (5-20 pages), sample first, last, and several in between
          pagesToProcess = [1, 2, Math.ceil(totalPages / 2), totalPages - 1, totalPages];
        } else {
          // For very small documents (1-5 pages), process all pages
          pagesToProcess = Array.from({length: totalPages}, (_, i) => i + 1);
        }
        
        // Sort page numbers and remove duplicates
        pagesToProcess = [...new Set(pagesToProcess)].sort((a, b) => a - b);

        // Apply an upper limit to avoid processing too many pages for very large documents
        if (pagesToProcess.length > 20) {
          // If we have too many pages, select a representative sample
          const maxPages = 20;
          const step = Math.ceil(pagesToProcess.length / maxPages);
          pagesToProcess = pagesToProcess.filter((_, index) => index % step === 0);
          
          // Always ensure first and last pages are included
          if (!pagesToProcess.includes(1)) pagesToProcess.unshift(1);
          if (!pagesToProcess.includes(totalPages)) pagesToProcess.push(totalPages);
          
          pagesToProcess.sort((a, b) => a - b);
        }
        
        // Extract text from PDF pages
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

        // Add document text with clear separation and metadata
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

    // Dynamic chunk size calculation based on total text volume and number of documents
    const averageDocSize = documentTexts.reduce((sum, text) => sum + text.length, 0) / documentTexts.length;
    const MAX_CHUNK_SIZE = Math.min(
      // Smaller of these two values:
      // 1. Size-based limit: Smaller chunks for larger documents
      averageDocSize > 10000 ? 4000 : (averageDocSize > 5000 ? 6000 : 8000),
      // 2. Count-based limit: Smaller chunks for more documents
      batchFiles.length > 15 ? 3000 : (batchFiles.length > 8 ? 4000 : 8000)
    );
    
    console.log(`Using dynamic chunk size of ${MAX_CHUNK_SIZE} characters (avg doc size: ${Math.round(averageDocSize)} chars)`);
    
    // Create chunks of document texts for processing
    const textChunks = [];
    let currentChunk = "";
    let currentChunkDocCount = 0;
    const MAX_DOCS_PER_CHUNK = 8; // Limit number of documents per chunk

    for (const docText of documentTexts) {
      // Create a new chunk if adding this document would exceed size or doc count limits
      if (currentChunk.length + docText.length > MAX_CHUNK_SIZE || currentChunkDocCount >= MAX_DOCS_PER_CHUNK) {
        if (currentChunk.length > 0) {
          textChunks.push(currentChunk);
        }
        currentChunk = docText;
        currentChunkDocCount = 1;
      } else {
        currentChunk += "\n\n" + docText;
        currentChunkDocCount++;
      }
    }

    if (currentChunk.length > 0) {
      textChunks.push(currentChunk);
    }
    
    console.log(`Split into ${textChunks.length} chunks for processing`);
    
    // Enhanced extraction prompt with more detailed instructions
    const extractionPrompt = `
    You are analyzing ${batchFiles.length} bank statements (indexed from 0). For each document:
    1. Identify which document index you're analyzing
    2. Extract these details PRECISELY:
      - Bank Name: The official name of the bank (e.g., "EQUITY BANK", "KCB", "I&M BANK")
      - Account Number: The full account number without spaces (e.g., "1234567890")
      - Currency: The currency code (KES, USD, GBP, EUR)
      - Statement Period: The date range covered (e.g., "01/01/2024 - 31/01/2024" or "January 2024")
      - Closing Balance: The ending balance for the period (number only)

    FORMAT YOUR RESPONSE as valid, parseable JSON objects, ONE OBJECT PER DOCUMENT:

      {
        "document_index": 0,
        "bank_name": "Example Bank",
        "account_number": "123456789",
        "currency": "USD",
        "statement_period": "Jan 2024 - Feb 2024",
        "closing_balance": 1250.75
      }

      {
        "document_index": 1,
        "bank_name": "Another Bank",
        ...
      }

      IMPORTANT: 
      - Each JSON object must be complete and valid
      - Do not include any explanatory text outside of the JSON objects
      - If you can't determine a value, use null instead of making up data
      - For currency codes, normalize to standard codes (KES, USD, GBP, EUR)
      - Extract ONLY what you can see in the document, don't invent information
      `;

    // Process each chunk with retry logic for API failures
    let consecutiveErrors = 0;
    let chunkResults = [];
    for (let i = 0; i < textChunks.length; i++) {
      try {
        onProgress(0.5 + 0.4 * (i / textChunks.length));
        
        console.log(`Processing chunk ${i+1} of ${textChunks.length}`);
        
        // Rotate API key if we had failures to avoid rate limits
        if (consecutiveErrors > 1) {
          console.log("Rotating API key due to previous failures");
          rotateApiKey();
          consecutiveErrors = 0;
        }
        
        const result = await extractionModel.generateContent([
          extractionPrompt, 
          textChunks[i]
        ]);
        
        const responseText = result.response.text();
        
        // Parse the results
        try {
          // First try: Look for a JSON array in the response
          const jsonMatches = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/g) || [];

          if (jsonMatches && jsonMatches.length > 0) {
            const extractedData = JSON.parse(jsonMatches[0]);

            if (Array.isArray(extractedData)) {
              console.log(`Successfully extracted ${extractedData.length} results from chunk ${i+1}`);
              extractedData.forEach(item => chunkResults.push(item));
              consecutiveErrors = 0; // Reset error counter on success
            } else {
              console.error("Response not in expected array format:", extractedData);
              consecutiveErrors++;
              
              // If it's an object, try to use it directly
              if (typeof extractedData === 'object' && extractedData !== null) {
                chunkResults.push(extractedData);
              }
            }
          } else {
            console.error("No JSON array found in response");
            consecutiveErrors++;
            
            // Second try: Look for individual JSON objects if array not found
            const objectMatches = Array.from(responseText.matchAll(/\{\s*"document_index"[\s\S]*?\}/g));
            if (objectMatches.length > 0) {
              console.log(`Found ${objectMatches.length} individual JSON objects in response`);
              
              for (const match of objectMatches) {
                try {
                  const data = JSON.parse(match[0]);
                  chunkResults.push(data);
                } catch (err) {
                  console.error("Error parsing individual object:", err);
                }
              }
            }
          }
        } catch (error) {
          console.error("Error parsing extraction result:", error);
          consecutiveErrors++;
        }
      } catch (error) {
        console.error(`Error processing chunk ${i+1}:`, error);
        consecutiveErrors++;
        
        // If we get an API error, rotate the key immediately
        if (error.message && (
            error.message.includes("429") || 
            error.message.includes("quota") || 
            error.message.includes("rate limit"))) {
          console.log("API rate limit hit, rotating key immediately");
          rotateApiKey();
        }
      }
    }
    
    // Combine and parse results
    const extractionResults = parseExtractionResults(chunkResults.join('\n'), batchFiles);
    
    // Add file references to results
    const resultsWithFiles = extractionResults.map(result => {
      const file = batchFiles.find(f => f.index === result.document_index);
      return {
        ...result,
        file: file ? file.originalItem : null
      };
    });
    
    onProgress(1.0);
    return {
      success: true,
      results: resultsWithFiles,
      passwordProtectedFiles
    };
  } catch (error) {
    console.error("Error in bulk extraction:", error);
    onProgress(1.0);
    return {
      success: false,
      error: error.message,
      results: [],
      passwordProtectedFiles
    };
  }
}

// Parse extraction results from text response
export function parseExtractionResults(responseText, batchFiles) {
  try {
    // First attempt: Try to parse directly
    try {
      // Replace consecutive JSON objects with array
      const jsonArrayString = '[' + responseText.replace(/}\s*{/g, '},{') + ']';
      return JSON.parse(jsonArrayString);
    } catch (e) {
      console.log("First parse attempt failed, trying individual JSON extraction:", e);
    }
    
    // Second attempt: Extract JSON objects one by one
    const results = [];
    const jsonRegex = /{[^}]*\}/g;
    const matches = responseText.match(jsonRegex) || [];

    for (let i = 0; i < matches.length; i++) {
      try {
        // Try to fix common JSON issues before parsing
        const fixedJson = repairJsonString(matches[i]);
        const parsedObj = JSON.parse(fixedJson);
        
        // Validate required fields
        if (parsedObj && typeof parsedObj.document_index !== 'undefined') {
          results.push(parsedObj);
        }
      } catch (parseErr) {
        console.error("Failed to parse individual JSON object:", parseErr);
      }
    }

    // If we didn't get results for all documents, add failed results
    for (const file of batchFiles) {
      if (!results.some(result => result.document_index === file.index)) {
        results.push({
          document_index: file.index,
          success: false,
          error: 'No extraction result found for this document'
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Error parsing extraction results:", error);
    // Return empty default objects as last resort
    return batchFiles.map(file => ({
      document_index: file.index,
      success: false,
      error: 'Failed to parse extraction results'
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
    const jsonMatches = responseText.match(/\{[^}]*\}/g) || [];

    for (let i = 0; i < jsonMatches.length; i++) {
      try {
        // Try to fix common JSON issues before parsing
        const fixedJson = repairJsonString(jsonMatches[i]);
        const parsedObj = JSON.parse(fixedJson);
        
        // Validate required fields
        if (parsedObj && typeof parsedObj.document_index !== 'undefined') {
          batchResults.push(parsedObj);
        }
      } catch (parseErr) {
        console.error("Failed to parse individual JSON object:", parseErr);
      }
    }

    // If we didn't get results for all documents, add failed results
    for (const file of files) {
      if (!batchResults.some(result => result.document_index === file.index)) {
        batchResults.push({
          document_index: file.index,
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
      document_index: file.index,
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
      data: arrayBuffer
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

// Normalize the extracted data
async function normalizeExtractedData(extractedData, params = {}, supabase = null) {
  const deepCopy = JSON.parse(JSON.stringify(extractedData));
  
  try {
    console.log('Normalizing extracted data', { 
      input: extractedData, 
      hasAccountNumber: !!extractedData?.account_number 
    });
    
    // Use account number to look up bank name if available
    let bankNameSource = 'none';
    
    if (extractedData.account_number && supabase) {
      try {
        console.log('Looking up bank name from account number:', extractedData.account_number);
        const bankDetails = await matchBankFromAccountNumber(extractedData.account_number, supabase);
        
        if (bankDetails && bankDetails.bank_name) {
          console.log(`Found bank name from database: ${bankDetails.bank_name}`);
          extractedData.bank_name = bankDetails.bank_name;
          bankNameSource = 'database';
        } else {
          console.log('No matching bank found in database for account:', extractedData.account_number);
        }
      } catch (bankLookupError) {
        console.error('Error looking up bank from account number:', bankLookupError);
      }
    }
    
    // Normalize to proper format even if we got from database
    if (extractedData.bank_name && typeof extractedData.bank_name === 'string') {
      // Replace placeholder text like "Bank Name" with null
      if (/bank\s+name/i.test(extractedData.bank_name)) {
        extractedData.bank_name = null;
      } 
      // Apply other normalizations even if we have a bank name from database
      else {
        const origBankName = extractedData.bank_name;
        extractedData.bank_name = normalizeText(extractedData.bank_name);
        
        // Track source only if we haven't set it already
        if (bankNameSource === 'none' && extractedData.bank_name !== origBankName) {
          bankNameSource = 'normalized';
        } else if (bankNameSource === 'none') {
          bankNameSource = 'extraction';
        }
      }
    }
    
    // Add the source tracking for bank name
    extractedData.bank_name_source = bankNameSource;
    
    // Continue with other normalizations...
    if (extractedData.account_number && typeof extractedData.account_number === 'string') {
      // Replace placeholder texts
      if (/account\s+number/i.test(extractedData.account_number)) {
        extractedData.account_number = null;
      } else {
        // Normalize account number - keep only digits and dashes
        extractedData.account_number = extractedData.account_number
          .replace(/[^\d-]/g, '') // Remove everything except digits and dashes
          .replace(/\-+/g, '-'); // Normalize multiple dashes to single dash
      }
    }
    
    // Currency normalization
    if (extractedData.currency && typeof extractedData.currency === 'string') {
      if (/currency/i.test(extractedData.currency)) {
        extractedData.currency = null;
      } else {
        extractedData.currency = normalizeText(extractedData.currency);
      }
    }
    
    // Statement period handling
    if (extractedData.statement_period && typeof extractedData.statement_period === 'string') {
      if (/statement\s+period/i.test(extractedData.statement_period)) {
        extractedData.statement_period = null;
      } else {
        extractedData.statement_period = normalizeText(extractedData.statement_period);
      }
    }
    
    // Helper function to process monthly balances
    const processMonthlyBalances = () => {
      const balances = Array.isArray(extractedData.monthly_balances)
        ? extractedData.monthly_balances.map(balance => ({
          month: balance.month,
          year: balance.year,
          closing_balance: typeof balance.closing_balance === 'number' 
            ? balance.closing_balance 
            : parseCurrencyAmount(balance.closing_balance),
          opening_balance: typeof balance.opening_balance === 'number'
            ? balance.opening_balance
            : parseCurrencyAmount(balance.opening_balance),
          statement_page: balance.statement_page || 1,
          highlight_coordinates: balance.highlight_coordinates || null,
          is_verified: balance.is_verified || false,
          verified_by: balance.verified_by || null,
          verified_at: balance.verified_at || null
        }))
        : [];

      // Ensure we have at least the current month in the balances if params are provided
      if (params.month && params.year) {
        const hasCurrentMonth = balances.some(
          balance => balance.month === params.month && balance.year === params.year
        );

        if (!hasCurrentMonth) {
          balances.push({
            month: params.month,
            year: params.year,
            closing_balance: parseCurrencyAmount(extractedData.closing_balance),
            opening_balance: parseCurrencyAmount(extractedData.opening_balance),
            statement_page: 1,
            highlight_coordinates: null,
            is_verified: false,
            verified_by: null,
            verified_at: null
          });
        }
      }

      return balances;
    };
    
    // Create the normalized structure to return
    const normalizedData = {
      bank_name: extractedData.bank_name || null,
      company_name: extractedData.company_name || null,
      account_number: extractedData.account_number || null,
      currency: extractedData.currency || 'KES',
      statement_period: extractedData.statement_period || null,
      closing_balance: parseCurrencyAmount(extractedData.closing_balance),
      opening_balance: parseCurrencyAmount(extractedData.opening_balance),
      monthly_balances: processMonthlyBalances(),
      bank_name_source: bankNameSource
    };
    
    console.log('Normalized data', { 
      normalized: normalizedData,
      bankNameSource: normalizedData.bank_name_source
    });
    
    return normalizedData;
  } catch (error) {
    console.error('Error in normalizeExtractedData:', error);
    return deepCopy; // Return the original data as a fallback
  }
}

// Helper function to match bank from account number using Supabase data
async function matchBankFromAccountNumber(accountNumber, supabase) {
  if (!accountNumber || !supabase) return null;
  
  try {
    console.log(`Attempting to match account number: ${accountNumber}`);
    
    // Query existing bank accounts from the database
    const { data: bankAccounts, error } = await supabase
      .from('acc_portal_banks')
      .select('id, bank_name, account_number')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching bank accounts:', error);
      return null;
    }
    
    if (!bankAccounts || bankAccounts.length === 0) {
      console.log('No bank accounts found in database');
      return null;
    }
    
    console.log(`Found ${bankAccounts.length} bank accounts in database`);
    
    // Clean the input account number - remove all non-digits
    const cleanAccountNumber = accountNumber.toString().replace(/\D/g, '');
    console.log(`Cleaned account number: ${cleanAccountNumber}`);
    
    // Try multiple matching strategies in order of priority
    
    // 1. Exact match (highest confidence)
    const exactMatch = bankAccounts.find(bank => 
      bank.account_number && bank.account_number.replace(/\D/g, '') === cleanAccountNumber
    );
    
    if (exactMatch) {
      console.log(`Found exact account number match: ${exactMatch.bank_name}`);
      return exactMatch.bank_name;
    }
    
    // 2. Contained match (account number contains or is contained in DB record)
    const containsMatch = bankAccounts.find(bank => {
      if (!bank.account_number) return false;
      const cleanBankAccountNumber = bank.account_number.replace(/\D/g, '');
      return cleanBankAccountNumber.includes(cleanAccountNumber) || 
             cleanAccountNumber.includes(cleanBankAccountNumber);
    });
    
    if (containsMatch) {
      console.log(`Found contains match for account number: ${containsMatch.bank_name}`);
      return containsMatch.bank_name;
    }
    
    // 3. Last digits match (common in statements that show partial numbers)
    if (cleanAccountNumber.length >= 4) {
      // Try last 4 digits
      const lastFourDigits = cleanAccountNumber.slice(-4);
      const partialMatch = bankAccounts.find(bank => 
        bank.account_number && bank.account_number.replace(/\D/g, '').slice(-4) === lastFourDigits
      );
      
      if (partialMatch) {
        console.log(`Found partial account number match (last 4 digits): ${partialMatch.bank_name}`);
        return partialMatch.bank_name;
      }
      
      // Try last 6 digits for longer account numbers
      if (cleanAccountNumber.length >= 6) {
        const lastSixDigits = cleanAccountNumber.slice(-6);
        const sixDigitMatch = bankAccounts.find(bank => 
          bank.account_number && bank.account_number.replace(/\D/g, '').slice(-6) === lastSixDigits
        );
        
        if (sixDigitMatch) {
          console.log(`Found partial account number match (last 6 digits): ${sixDigitMatch.bank_name}`);
          return sixDigitMatch.bank_name;
        }
      }
    }
    
    // 4. First digits match (bank identification prefix)
    if (cleanAccountNumber.length >= 4) {
      // Try first 4-6 digits (common bank prefixes)
      for (let prefixLength = 6; prefixLength >= 4; prefixLength--) {
        if (cleanAccountNumber.length >= prefixLength) {
          const prefix = cleanAccountNumber.substring(0, prefixLength);
          const prefixMatch = bankAccounts.find(bank => {
            const bankCleanNumber = bank.account_number?.replace(/\D/g, '') || '';
            return bankCleanNumber.length >= prefixLength && 
                   bankCleanNumber.substring(0, prefixLength) === prefix;
          });
          
          if (prefixMatch) {
            console.log(`Found bank prefix match (first ${prefixLength} digits): ${prefixMatch.bank_name}`);
            return prefixMatch.bank_name;
          }
        }
      }
    }
    
    console.log('No matching bank account found in database after trying all methods');
    return null;
  } catch (error) {
    console.error('Error matching bank from account number:', error);
    return null;
  }
}

// Dynamic import for canvas in Node.js environment
const getCanvas = async () => {
  if (typeof window === 'undefined') {
    return require('canvas');
  }
  return require('canvas-browserify');
};