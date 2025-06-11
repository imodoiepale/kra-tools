// @ts-nocheck
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import * as pdfjsLib from 'pdfjs-dist';
import { API_KEYS } from './apiKeys';

// --- Constants and Setup ---

const EMBEDDING_MODEL = "gemini-embedding-exp-03-07";
const EXTRACTION_MODEL = "gemini-2.0-flash"; // A modern, reliable model is recommended
const RATE_LIMIT_COOLDOWN = 60000;
const MAX_FAILURES = 5;

let currentApiKeyIndex = 0;
let genAI = new GoogleGenerativeAI(API_KEYS[currentApiKeyIndex]);

const apiKeyStatus = new Map(API_KEYS.map(key => [key, {
  failureCount: 0,
  cooldownUntil: 0
}]));


// --- API Key Management ---

const getNextApiKey = () => {
  // This logic can be as complex as needed for key rotation.
  // For now, we'll keep it simple but functional.
  // Your original rotation logic is fine to use here.
  return API_KEYS[currentApiKeyIndex];
};

const markApiKeyFailure = (key) => {
  const status = apiKeyStatus.get(key);
  if (!status) return;
  status.failureCount++;
  if (status.failureCount >= MAX_FAILURES) {
    status.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN;
    console.warn(`API key ending in ...${key.slice(-4)} is on cooldown.`);
  }
};


// --- Helper Functions ---

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

// --- PDF Processing ---

async function getPdfPageText(fileUrl, password = null) {
  let pdf;
  try {
    const loadingTaskOptions = { password };
    if (typeof fileUrl === 'string') {
      loadingTaskOptions.url = fileUrl;
    } else if (fileUrl instanceof File) {
      const arrayBuffer = await fileUrl.arrayBuffer();
      loadingTaskOptions.data = new Uint8Array(arrayBuffer);
    } else {
      throw new Error('Invalid file input type');
    }

    pdf = await pdfjsLib.getDocument(loadingTaskOptions).promise;

    const pagesToExtract = new Set([1]);
    if (pdf.numPages > 1) {
      pagesToExtract.add(pdf.numPages);
    }

    let textByPage = {};
    for (const pageNum of pagesToExtract) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      textByPage[pageNum] = textContent.items.map(item => item.str).join(' ');
    }
    return { success: true, textByPage, totalPages: pdf.numPages };
  } catch (error) {
    if (error.name === 'PasswordException') {
      return { success: false, error: 'PDF is password protected.', requiresPassword: true };
    }
    console.error('Error extracting text from PDF:', error);
    return { success: false, error: 'Failed to read text from PDF file.' };
  }
}

// --- Gemini API Functions ---

async function generateTextEmbeddings(textContent) {
  try {
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text: textContent }], role: "user" },
    });
    return result.embedding;
  } catch (error) {
    console.warn('Could not generate embeddings:', error.message);
    return null; // Non-fatal error, extraction can proceed without it.
  }
}

function normalizeExtractedData(extractedData, params) {
  const processMonthlyBalances = () => {
    if (!Array.isArray(extractedData.monthly_balances)) return [];
    return extractedData.monthly_balances.map(balance => ({
      month: typeof balance.month === 'string' ? parseInt(balance.month, 10) : balance.month,
      year: typeof balance.year === 'string' ? parseInt(balance.year, 10) : balance.year,
      closing_balance: parseCurrencyAmount(balance.closing_balance),
      opening_balance: parseCurrencyAmount(balance.opening_balance),
      statement_page: balance.statement_page || 1,
      is_verified: false,
    })).filter(b => !isNaN(b.month) && !isNaN(b.year));
  };

  return {
    bank_name: extractedData.bank_name || null,
    company_name: extractedData.company_name || null,
    account_number: extractedData.account_number || null,
    currency: extractedData.currency ? normalizeCurrencyCode(extractedData.currency) : null,
    statement_period: extractedData.statement_period || null,
    monthly_balances: processMonthlyBalances()
  };
}

async function processExtraction(pageTextContent, params, onProgress) {
  try {
    onProgress?.('Generating embeddings...');
    const pageText = Object.values(pageTextContent).join("\n\n--- PAGE BREAK ---\n\n");
    await generateTextEmbeddings(pageText); // Preserving this step from your original logic

    onProgress?.('Running extraction model...');

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
    if (!jsonMatch || !jsonMatch[0]) {
      console.error("AI response did not contain a JSON block. Full response:", responseText);
      throw new Error('No JSON found in response');
    }

    let extractedData;
    try {
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (jsonError) {
      console.error('Failed to parse the extracted JSON block. Error:', jsonError);
      console.error('Problematic JSON string from AI:', jsonMatch[0]);
      throw new Error('AI returned malformed JSON');
    }

    return normalizeExtractedData(extractedData, params);

  } catch (error) {
    console.error('Error in extraction process:', error);
    throw error;
  }
}

// --- Main Exported Function ---

export async function performBankStatementExtraction(fileUrl, params, onProgress = (message) => console.log(message)) {
  try {
    onProgress('Starting bank statement extraction...');

    const textResult = await getPdfPageText(fileUrl);
    if (!textResult.success) {
      throw new Error(textResult.error);
    }

    onProgress(`Text extracted from PDF. Calling AI model...`);

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
      message: `Extraction failed: ${error.message}`,
      extractedData: {
        bank_name: null,
        company_name: null,
        account_number: null,
        currency: null,
        statement_period: null,
        closing_balance: null,
        monthly_balances: []
      },
    };
  }
}

// --- Bulk and Multi-Month Functions (as provided originally) ---

function parseStatementPeriod(periodString) {
  if (!periodString) return null;
  const singleMonthMatch = periodString.match(/(\w+)\s+(\d{4})/i);
  if (singleMonthMatch) {
    const month = new Date(`${singleMonthMatch[1]} 1, 2000`).getMonth() + 1;
    const year = parseInt(singleMonthMatch[2]);
    return { startMonth: month, startYear: year, endMonth: month, endYear: year };
  }
  const sameYearMatch = periodString.match(/(\w+)\s*(?:-|to)\s*(\w+)\s+(\d{4})/i);
  if (sameYearMatch) {
    const startMonth = new Date(`${sameYearMatch[1]} 1, 2000`).getMonth() + 1;
    const endMonth = new Date(`${sameYearMatch[2]} 1, 2000`).getMonth() + 1;
    const year = parseInt(sameYearMatch[3]);
    return { startMonth, startYear: year, endMonth, endYear: year };
  }
  const differentYearMatch = periodString.match(/(\w+)\s+(\d{4})\s*(?:-|to)\s*(\w+)\s+(\d{4})/i);
  if (differentYearMatch) {
    const startMonth = new Date(`${differentYearMatch[1]} 1, 2000`).getMonth() + 1;
    const startYear = parseInt(differentYearMatch[2]);
    const endMonth = new Date(`${differentYearMatch[3]} 1, 2000`).getMonth() + 1;
    const endYear = parseInt(differentYearMatch[4]);
    return { startMonth, startYear, endMonth, endYear };
  }
  return null;
}

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

export async function processBulkExtraction(batchFiles, params, onProgress) {
  // This function would contain the logic for handling multiple files.
  // For now, it will process them one by one. A more advanced implementation
  // could batch requests to the AI.
  const results = [];
  for (let i = 0; i < batchFiles.length; i++) {
    const file = batchFiles[i];
    onProgress((i + 1) / batchFiles.length * 100);
    const result = await performBankStatementExtraction(file.fileUrl, params);
    results.push({
      index: file.index,
      success: result.success,
      extractedData: result.extractedData,
      error: result.success ? null : result.message,
      originalItem: file.originalItem,
    });
  }
  return results;
}