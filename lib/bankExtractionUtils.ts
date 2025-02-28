// @ts-nocheck

import { supabase } from '@/lib/supabase'
import { GoogleGenerativeAI } from "@google/generative-ai";
import dayjs from 'dayjs';
import { API_KEYS } from './apiKeys';

// Constants
const CHUNK_SIZE = 5; // Process 3 pages at a time
const MAX_CONCURRENT_REQUESTS = 3; // Process 4 chunks in parallel
const RATE_LIMIT_COOLDOWN = 60000; // 1 minute cooldown
const MAX_FAILURES = 3; // Max consecutive failures before cooling down

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

// Create virtual chunks without actually parsing the PDF
function createVirtualChunks(estimatedPages = 20) {
    const chunks = [];
    // Create chunk ranges based on estimated page count
    for (let i = 1; i <= estimatedPages; i += CHUNK_SIZE) {
        const endPage = Math.min(i + CHUNK_SIZE - 1, estimatedPages);
        chunks.push({
            startPage: i,
            endPage,
            pageCount: endPage - i + 1
        });
    }
    return chunks;
}

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
        onProgress('Starting bank statement extraction...');

        // Create virtual chunks - assume 20 pages but the AI will handle actual page count
        const estimatedPageCount = 20; // Reasonable default for most bank statements
        const chunks = createVirtualChunks(estimatedPageCount);
        onProgress(`Breaking extraction into ${chunks.length} chunks to increase accuracy...`);

        // Process chunks in parallel with limiting concurrency
        const processChunksInBatches = async () => {
            let allResults = [];

            // Process chunks in batches to limit concurrency
            for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_REQUESTS) {
                const currentBatch = chunks.slice(i, i + MAX_CONCURRENT_REQUESTS);
                onProgress(`Processing batch ${Math.floor(i / MAX_CONCURRENT_REQUESTS) + 1} of ${Math.ceil(chunks.length / MAX_CONCURRENT_REQUESTS)}...`);

                // Process current batch in parallel
                const batchPromises = currentBatch.map(chunk =>
                    processChunk(fileUrl, chunk, params, onProgress)
                );

                const batchResults = await Promise.all(batchPromises);
                allResults = [...allResults, ...batchResults];

                // Add a small delay between batches to avoid rate limiting
                if (i + MAX_CONCURRENT_REQUESTS < chunks.length) {
                    onProgress('Pausing briefly before processing next batch...');
                    await delay(2000);
                }
            }

            return allResults;
        };

        // Process all chunks
        const chunkResults = await processChunksInBatches();
        onProgress(`Completed extraction of ${chunkResults.length} chunks. Merging results...`);

        // Merge results from all chunks
        const mergedData = mergeChunkResults(chunkResults, params, onProgress);
        onProgress('Results merged successfully.');

        return {
            success: true,
            extractedData: mergedData
        };

    } catch (error) {
        console.error('Error in extraction process:', error);
        onProgress(`Error encountered: ${error.message}. Returning partial results if available.`);

        // Return empty data as a fallback
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

// Merge results from multiple chunks
function mergeChunkResults(chunkResults, params, onProgress) {
    onProgress?.('Merging extracted data from all chunks...');

    // Count the number of successful chunks
    const successfulChunks = chunkResults.filter(result => result.success && result.extractedData);
    onProgress?.(`Processing ${successfulChunks.length} successful chunks out of ${chunkResults.length} total chunks.`);

    // Initialize merged data structure
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

    // Track confidence in each field
    const confidence = {
        bank_name: 0,
        company_name: 0,
        account_number: 0,
        currency: 0,
        statement_period: 0,
        opening_balance: 0,
        closing_balance: 0
    };

    // Collect all monthly balances
    const allMonthlyBalances = [];

    // Log initial count for debugging
    let totalInitialMonthlyBalances = 0;

    // Process each chunk result
    chunkResults.forEach((result, index) => {
        if (!result.success || !result.extractedData) return;

        const data = result.extractedData;

        // Log monthly balances per chunk for debugging
        if (Array.isArray(data.monthly_balances)) {
            onProgress?.(`Chunk ${index + 1} (pages ${result.chunk.startPage}-${result.chunk.endPage}) contains ${data.monthly_balances.length} monthly balances.`);
            totalInitialMonthlyBalances += data.monthly_balances.length;
        }

        // Update text fields with highest confidence
        ['bank_name', 'company_name', 'account_number', 'currency', 'statement_period'].forEach(field => {
            if (data[field] && data[field].length > 0) {
                const newConfidence = data[field].length;
                if (newConfidence > confidence[field]) {
                    merged[field] = data[field];
                    confidence[field] = newConfidence;
                }
            }
        });

        // Update numeric fields with highest confidence
        ['opening_balance', 'closing_balance'].forEach(field => {
            if (data[field] !== null) {
                merged[field] = data[field];
                confidence[field]++;
            }
        });

        // Collect all monthly balances
        if (Array.isArray(data.monthly_balances)) {
            // Filter out incomplete monthly balances
            const validBalances = data.monthly_balances.filter(balance =>
                balance &&
                typeof balance.month === 'number' &&
                typeof balance.year === 'number'
            );

            allMonthlyBalances.push(...validBalances);
        }
    });

    onProgress?.(`Total monthly balances found across all chunks: ${totalInitialMonthlyBalances}`);
    onProgress?.(`After filtering invalid entries: ${allMonthlyBalances.length}`);

    // Normalize currency
    if (merged.currency) {
        merged.currency = normalizeCurrencyCode(merged.currency);
    }

    // Deduplicate monthly balances with improved logic
    const balanceMap = new Map();

    allMonthlyBalances.forEach(balance => {
        if (!balance.month || !balance.year) return;

        const key = `${balance.year}-${balance.month}`;

        // Define a confidence score for this balance entry
        const balanceConfidence =
            (balance.opening_balance !== null ? 1 : 0) +
            (balance.closing_balance !== null ? 1 : 0) +
            (balance.opening_date ? 1 : 0) +
            (balance.closing_date ? 1 : 0) +
            (balance.statement_page ? 1 : 0);

        if (!balanceMap.has(key)) {
            balanceMap.set(key, {
                balance,
                confidence: balanceConfidence
            });
        } else {
            // If we already have a balance for this month, compare confidence
            const existing = balanceMap.get(key);

            if (balanceConfidence > existing.confidence) {
                // Replace with higher confidence entry
                balanceMap.set(key, {
                    balance,
                    confidence: balanceConfidence
                });
            } else if (balanceConfidence === existing.confidence) {
                // Merge entries with equal confidence, taking non-null values
                balanceMap.set(key, {
                    balance: {
                        ...existing.balance,
                        opening_balance: balance.opening_balance !== null ? balance.opening_balance : existing.balance.opening_balance,
                        closing_balance: balance.closing_balance !== null ? balance.closing_balance : existing.balance.closing_balance,
                        opening_date: balance.opening_date || existing.balance.opening_date,
                        closing_date: balance.closing_date || existing.balance.closing_date,
                        statement_page: balance.statement_page || existing.balance.statement_page
                    },
                    confidence: existing.confidence
                });
            }
        }
    });

    // Extract just the balance objects and sort by year and month
    merged.monthly_balances = Array.from(balanceMap.values())
        .map(item => item.balance)
        .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });

    onProgress?.(`After deduplication: ${merged.monthly_balances.length} unique monthly balances`);

    // Ensure we have the requested month/year
    const hasRequestedMonth = merged.monthly_balances.some(
        balance => balance.month === params.month && balance.year === params.year
    );

    if (!hasRequestedMonth && (merged.opening_balance !== null || merged.closing_balance !== null)) {
        onProgress?.(`Adding requested month (${params.month}/${params.year}) that wasn't found in extractions`);
        merged.monthly_balances.push({
            month: params.month,
            year: params.year,
            opening_balance: merged.opening_balance || 0,
            closing_balance: merged.closing_balance || 0,
            statement_page: 1,
            highlight_coordinates: null,
            is_verified: false,
            verified_by: null,
            verified_at: null
        });
    }

    // If statement period is missing, generate one from monthly balances
    if (!merged.statement_period && merged.monthly_balances.length > 0) {
        const balances = merged.monthly_balances;

        // Format dates for statement period
        const firstMonth = balances[0];
        const lastMonth = balances[balances.length - 1];
        const startDate = `01/${firstMonth.month.toString().padStart(2, '0')}/${firstMonth.year}`;

        // Calculate last day of the month for end date
        const lastDay = new Date(lastMonth.year, lastMonth.month, 0).getDate();
        const endDate = `${lastDay}/${lastMonth.month.toString().padStart(2, '0')}/${lastMonth.year}`;

        merged.statement_period = `${startDate} - ${endDate}`;
        onProgress?.(`Generated statement period from monthly balances: ${merged.statement_period}`);
    }

    if (!merged.statement_period) {
        // Generate a statement period for the requested month
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Calculate first and last day of requested month
        const daysInMonth = new Date(params.year, params.month, 0).getDate();
        const startDate = `01/${params.month.toString().padStart(2, '0')}/${params.year}`;
        const endDate = `${daysInMonth}/${params.month.toString().padStart(2, '0')}/${params.year}`;

        merged.statement_period = `${startDate} - ${endDate}`;
        onProgress?.(`Generated statement period for requested month: ${merged.statement_period}`);
    }

    return merged;
}