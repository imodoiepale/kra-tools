// @ts-nocheck

import { supabase } from '@/lib/supabase';
import { Groq } from 'groq-sdk';
import dayjs from 'dayjs';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Constants
const RATE_LIMIT_COOLDOWN = 60000; // 1 minute cooldown
const MAX_FAILURES = 5; // Max consecutive failures before cooling down

// Initialize the Groq API
const GROQ_API_KEY = process.env.GROQ_API_KEY || '1234';
let groq = new Groq({ apiKey: GROQ_API_KEY, dangerouslyAllowBrowser: true })
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

// Delay helper function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to extract text from PDF page using Tesseract
async function extractTextFromPdfPage(fileUrl, pageNum) {
  try {
    // Load the PDF
    let pdf;
    if (typeof fileUrl === 'string') {
      pdf = await pdfjsLib.getDocument(fileUrl).promise;
    } else if (fileUrl instanceof File) {
      const arrayBuffer = await fileUrl.arrayBuffer();
      pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
    } else {
      throw new Error('Invalid file input type');
    }

    // Get total pages to handle special case for last page
    const totalPages = pdf.numPages;

    // If pageNum is -1, it means we want the last page
    if (pageNum === -1) {
      pageNum = totalPages;
    }

    // Make sure pageNum is valid
    if (pageNum < 1 || pageNum > totalPages) {
      throw new Error(`Invalid page number: ${pageNum}. PDF has ${totalPages} pages.`);
    }

    // Get the specified page
    const page = await pdf.getPage(pageNum);

    // Extract text content
    const textContent = await page.getTextContent();

    // Combine the text items into a single string
    const text = textContent.items.map(item => item.str).join(' ');

    return {
      text: text,
      pageNum: pageNum
    };
  } catch (error) {
    console.error(`Error extracting text from page ${pageNum}:`, error);
    return {
      text: '',
      pageNum: pageNum,
      error: error.message
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

// Process a single page using Groq
async function processPage(pageData, params, onProgress) {
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    try {
      onProgress?.(`Processing page ${pageData.pageNum}...`);

      // Create prompt with the extracted text
      const prompt = `
Analyze the following text extracted from page ${pageData.pageNum} of a bank statement and extract the key financial information:

TEXT FROM PDF:
${pageData.text}

Extract the following key financial information:

1. Bank Details:
   - Bank Name: Identify the official bank name (e.g., "Prime Bank", "Equity Bank")
   - Account Number: Extract the complete account number, including any formatting characters
   - Currency: Determine the currency used (e.g., KES, USD, EUR)

2. Statement Period:
   - Find the exact date range stated on the document (format: DD/MM/YYYY - DD/MM/YYYY)
   - Identify any specific month/year labels in the document

3. Account Holder:
   - Company Name: Extract the full, official name of the account holder

4. Balance Information:
   - Opening Balance: The starting balance at the beginning of the statement period
   - Closing Balance: The final balance at the end of the statement period

5. Monthly Breakdown:
   - Month and Year: Identify each distinct month covered in the statement
   - Monthly Opening Balance: First balance shown for that month, or balance brought forward
   - Monthly Closing Balance: Last balance shown for that month, or balance carried forward

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

      onProgress?.(`Analyzing content of page ${pageData.pageNum}...`);

      // Use Groq API to analyze the text
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 8192,
        top_p: 0.8
      });

      const text = chatCompletion.choices[0]?.message?.content;

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
            statement_page: balance.statement_page || pageData.pageNum,
            highlight_coordinates: null,
            is_verified: false,
            verified_by: null,
            verified_at: null,
            opening_date: balance.opening_date || null,
            closing_date: balance.closing_date || null
          }))
          : []
      };

      return {
        success: true,
        extractedData: normalizedData,
        pageNum: pageData.pageNum
      };

    } catch (error) {
      attempts++;
      console.error(`Extraction attempt ${attempts} failed for page ${pageData.pageNum}:`, error);

      if (attempts < MAX_ATTEMPTS) {
        onProgress?.(`Extraction failed. Retrying (attempt ${attempts + 1}/${MAX_ATTEMPTS})...`);
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
          pageNum: pageData.pageNum,
          message: `Extraction failed after ${MAX_ATTEMPTS} attempts for page ${pageData.pageNum}.`
        };
      }
    }
  }
}

// Main extraction function using only first and last page
export async function performBankStatementExtraction(
  fileUrl,
  params,
  onProgress = (message) => console.log(message)
) {
  try {
    onProgress('Starting bank statement extraction (first and last pages only)...');

    // Extract text from first page using Tesseract
    onProgress('Extracting text from first page...');
    const firstPageText = await extractTextFromPdfPage(fileUrl, 1);

    // Get total page count
    const totalPages = await getPdfPageCount(fileUrl);

    // Extract text from last page using Tesseract
    onProgress('Extracting text from last page...');
    const lastPageText = await extractTextFromPdfPage(fileUrl, totalPages);

    // Process extracted text with Groq
    onProgress('Analyzing first page content...');
    const firstPageResult = await processPage(firstPageText, params, onProgress);

    onProgress('Analyzing last page content...');
    const lastPageResult = await processPage(lastPageText, params, onProgress);

    // Merge results from first and last pages
    const mergedData = mergeFirstAndLastPageResults(
      firstPageResult,
      lastPageResult,
      params,
      onProgress
    );

    onProgress('Bank statement extraction completed successfully.');

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

    // Include any monthly balances from first page
    if (firstPageResult.extractedData.monthly_balances?.length > 0) {
      merged.monthly_balances = [
        ...merged.monthly_balances,
        ...firstPageResult.extractedData.monthly_balances
      ];
    }
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

    // Include any monthly balances from last page (if not already included)
    if (lastPageResult.extractedData.monthly_balances?.length > 0) {
      // Filter out duplicates by month/year
      const existingMonths = new Set(
        merged.monthly_balances.map(mb => `${mb.month}-${mb.year}`)
      );

      const newBalances = lastPageResult.extractedData.monthly_balances.filter(
        mb => !existingMonths.has(`${mb.month}-${mb.year}`)
      );

      merged.monthly_balances = [
        ...merged.monthly_balances,
        ...newBalances
      ];
    }
  }

  // Ensure we have the requested month (for UI manual entry)
  if (!merged.monthly_balances.some(mb => mb.month === params.month && mb.year === params.year)) {
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
  }

  return merged;
}

// Parse statement period from string (e.g., "01/01/2023 - 31/01/2023")
function parseStatementPeriod(periodStr) {
  if (!periodStr) return null;

  // Try various formats
  const formats = [
    // DD/MM/YYYY - DD/MM/YYYY
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // DD-MM-YYYY - DD-MM-YYYY
    /(\d{1,2})-(\d{1,2})-(\d{4})\s*-\s*(\d{1,2})-(\d{1,2})-(\d{4})/,
    // YYYY-MM-DD - YYYY-MM-DD
    /(\d{4})-(\d{1,2})-(\d{1,2})\s*-\s*(\d{4})-(\d{1,2})-(\d{1,2})/
  ];

  for (const format of formats) {
    const match = periodStr.match(format);
    if (match) {
      if (format === formats[0] || format === formats[1]) {
        // DD/MM/YYYY or DD-MM-YYYY format
        return {
          startMonth: parseInt(match[2], 10),
          startYear: parseInt(match[3], 10),
          endMonth: parseInt(match[5], 10),
          endYear: parseInt(match[6], 10)
        };
      } else {
        // YYYY-MM-DD format
        return {
          startMonth: parseInt(match[2], 10),
          startYear: parseInt(match[1], 10),
          endMonth: parseInt(match[5], 10),
          endYear: parseInt(match[4], 10)
        };
      }
    }
  }

  return null;
}

// Generate array of all months in a range
function generateMonthRange(startMonth, startYear, endMonth, endYear) {
  const months = [];

  let currentYear = startYear;
  let currentMonth = startMonth;

  while (
    currentYear < endYear ||
    (currentYear === endYear && currentMonth <= endMonth)
  ) {
    months.push({
      month: currentMonth,
      year: currentYear
    });

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return months;
}