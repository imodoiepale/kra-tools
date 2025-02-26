// bankExtractionUtils.ts
import { supabase } from '@/lib/supabase'
import { GoogleGenerativeAI } from "@google/generative-ai";
import dayjs from 'dayjs';
import { API_KEYS } from './apiKeys';

interface ExtractorParams {
    month: number;
    year: number;
}

interface MonthlyBalance {
    month: number;
    year: number;
    closing_balance: number;
    opening_balance: number;
    statement_page: number;
    highlight_coordinates: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        page: number;
    } | null;
    is_verified: boolean;
    verified_by: string | null;
    verified_at: string | null;
}

interface ExtractionResult {
    success: boolean;
    extractedData: {
        bank_name: string | null;
        company_name: string | null;
        account_number: string | null;
        currency: string | null;
        statement_period: string | null;
        opening_balance: number | null;
        closing_balance: number | null;
        raw_text?: string | null;
        monthly_balances: MonthlyBalance[];
    };
    message?: string;
}

// Initialize the Gemini API
let currentApiKeyIndex = 0;
let genAI = new GoogleGenerativeAI(API_KEYS[currentApiKeyIndex]);

// Track rate limits for each API key
const apiKeyStatus = new Map<string, {
    lastUsed: number;
    failureCount: number;
    cooldownUntil: number;
}>();

// Initialize status for all API keys
API_KEYS.forEach(key => {
    apiKeyStatus.set(key, {
        lastUsed: 0,
        failureCount: 0,
        cooldownUntil: 0
    });
});

const RATE_LIMIT_COOLDOWN = 60000; // 1 minute cooldown
const MAX_FAILURES = 3; // Max consecutive failures before cooling down

const getNextAvailableApiKey = (): string | null => {
    const now = Date.now();

    // Try to find a key that's not in cooldown
    for (let i = 0; i < API_KEYS.length; i++) {
        const key = API_KEYS[i];
        const status = apiKeyStatus.get(key);

        if (!status) continue;

        // Skip keys in cooldown
        if (now < status.cooldownUntil) continue;

        // Reset failure count if it's been more than the cooldown period
        if (now - status.lastUsed > RATE_LIMIT_COOLDOWN) {
            status.failureCount = 0;
        }

        // Use this key if it hasn't failed too many times
        if (status.failureCount < MAX_FAILURES) {
            return key;
        }
    }

    return null; // All keys are in cooldown
};

const markApiKeyFailure = (key: string) => {
    const status = apiKeyStatus.get(key);
    if (!status) return;

    status.failureCount++;
    status.lastUsed = Date.now();

    // Put key in cooldown if it's failed too many times
    if (status.failureCount >= MAX_FAILURES) {
        status.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN;
        console.log(`API key ${key} put in cooldown until ${new Date(status.cooldownUntil).toISOString()}`);
    }

    apiKeyStatus.set(key, status);
};

const resetApiKeyStatus = (key: string) => {
    apiKeyStatus.set(key, {
        lastUsed: Date.now(),
        failureCount: 0,
        cooldownUntil: 0
    });
};

// Update getNextApiKey to use the new rotation mechanism
const getNextApiKey = (): string => {
    const nextKey = getNextAvailableApiKey();

    if (!nextKey) {
        // All keys are in cooldown, wait for the shortest cooldown
        const minCooldown = Math.min(...Array.from(apiKeyStatus.values()).map(s => s.cooldownUntil));
        const waitTime = Math.max(0, minCooldown - Date.now());

        if (waitTime > 0) {
            console.log(`All API keys are in cooldown. Waiting ${waitTime}ms...`);
            return API_KEYS[0]; // Return first key, it will fail but that's okay
        }

        // Reset all keys if all are in cooldown
        API_KEYS.forEach(key => resetApiKeyStatus(key));
    }

    return nextKey || API_KEYS[0];
};

const generationConfig = {
    temperature: 0.2,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 8192,
};

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig,
});

// Map file extensions to MIME types
const mimeTypes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/jpeg',
    '.tiff': 'image/jpeg',
    '.webp': 'image/jpeg',
};

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

const KENYAN_BANKS = [
    /African Banking Corp/i,
    /Bank of Africa Kenya/i,
    /Bank of India/i,
    /Bank of Baroda/i,
    /Barclays Bank of Kenya/i,
    /ABSA/i,
    /CfC Stanbic Bank/i,
    /Chase Bank/i,
    /Citibank N.A./i,
    /Commercial Bank of Africa/i,
    /Consolidated Bank of Kenya/i,
    /Co-operative Bank of Kenya/i,
    /Credit Bank/i,
    /Development Bank/i,
    /Diamond Trust Bank/i,
    /Dubai Bank/i,
    /Ecobank/i,
    /Equatorial Commercial Bank/i,
    /Equity Bank/i,
    /Family Bank/i,
    /Faulu Bank/i,
    /Fidelity Commercial Bank/i,
    /Fina Bank/i,
    /First Community Bank/i,
    /Giro Commercial Bank/i,
    /Guardian Bank/i,
    /Gulf African Bank/i,
    /Habib Bank A.G. Zurich/i,
    /Habib Bank/i,
    /Housing Finance Company of Kenya/i,
    /Imperial Bank/i,
    /I & M Bank/i,
    /Jamii Bora Bank/i,
    /K-Rep Bank/i,
    /Kenya Commercial Bank/i,
    /Kenya Women Microfinance Bank/i,
    /Middle East Bank/i,
    /National Bank of Kenya/i,
    /NIC Bank/i,
    /Oriental Bank/i,
    /Paramount Universal Bank/i,
    /Prime Bank/i,
    /Postbank/i,
    /Standard Chartered Bank/i,
    /Transnational Bank/i,
    /UBA Kenya Bank/i,
    /Victoria Commercial Bank/i
];

// Common currency codes
const CURRENCY_CODES = ["KES", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "INR"];

// Common patterns for account numbers
const ACCOUNT_NUMBER_PATTERNS = [
    /Account\s+No\.?\s*[:.]?\s*(\d[\d\s-]+\d)/i,
    /A\/C\s+No\.?\s*[:.]?\s*(\d[\d\s-]+\d)/i,
    /Account\s+Number\s*[:.]?\s*(\d[\d\s-]+\d)/i
];

// Utility function to convert file to a format usable by the AI model
async function fileToGenerativePart(fileInput: string | File, originalFileName?: string): Promise<any> {
    try {
        let mimeType: string;
        let data: Uint8Array;

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
        if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
            console.warn('Mime type not explicitly supported:', mimeType);
            // Instead of throwing error, try to infer from extension
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to parse currency amounts
function parseCurrencyAmount(amount: string): number | null {
    if (!amount) return null;

    // Remove currency symbols, commas, and other non-numeric characters
    // but keep decimal points and negative signs
    const cleanedAmount = amount.replace(/[^\d.-]/g, '');

    // Parse as float
    const parsedAmount = parseFloat(cleanedAmount);

    return isNaN(parsedAmount) ? null : parsedAmount;
}

// Helper function to parse dates in various formats
function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Try various formats
    const formats = [
        'DD/MM/YYYY',
        'MM/DD/YYYY',
        'YYYY-MM-DD',
        'DD-MM-YYYY',
        'DD.MM.YYYY',
        'YYYY/MM/DD'
    ];

    for (const format of formats) {
        const date = dayjs(dateStr, format);
        if (date.isValid()) return date.toDate();
    }

    return null;
}

// Main extraction function
export async function performBankStatementExtraction(
    fileUrl: string,
    params: ExtractorParams,
    onProgress?: (message: string) => void
): Promise<ExtractionResult> {
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts < MAX_ATTEMPTS) {
        try {
            onProgress?.(`Attempt ${attempts + 1}/${MAX_ATTEMPTS}: Processing bank statement...`);

            const filePart = await fileToGenerativePart(fileUrl);

            const monthName = new Date(params.year, params.month - 1, 1).toLocaleString('en-US', { month: 'long' });
            const prompt = `
    Analyze this bank statement PDF and extract the following information:

    1. Bank Name: Look for the official bank name, often in the header or footer of the document.
    2. Account Number: Find the full account number or last 4-5 digits if partially masked.
    3. Currency: Identify the currency used in the statement (e.g., KES OR KSH, USD).
    4. Statement Period: Extract the full date range covered by this statement.
    5. Opening Balance: Find the opening/starting balance for the first date in the statement.
    6. Closing Balance: Find the closing/ending balance for the last date in the statement.
    7. Monthly Balances: For each month in the statement:
       - Find the first balance shown for that month (opening)
       - Find the last balance shown for that month (closing)
       - Note the page number where each balance is found
       - Note any running or carried forward balances between months
    8. Company Name: Look for the official Company name.

    IMPORTANT: For EACH MONTH in the statement:
    - Look for "Balance B/F", "Brought Forward", or the first transaction balance for month opening
    - Look for "Balance C/F", "Carried Forward", or the last transaction balance for month closing
    - Record the exact date and page number for each balance found
    
    Examine ALL pages carefully for balance information.
    
    Return the data in this JSON format:
    {
      "bank_name": "Bank Name",
      "account_number": "Account Number",
      "currency": "Currency Code",
      "statement_period": "Start Date - End Date",
      "opening_balance": number,
      "closing_balance": number,
      "company_name": "Company Name",
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
      ],
      "pages_checked": [1, 2, 3]
    }`;

            onProgress?.('Extracting data from bank statement...');

            // Rotate API keys if needed
            if (attempts > 0) {
                const nextKey = getNextApiKey();
                currentApiKeyIndex = API_KEYS.indexOf(nextKey);
                genAI = new GoogleGenerativeAI(nextKey);
            }

            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                generationConfig,
            });

            const result = await model.generateContent([prompt, filePart]);
            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error('No text generated from the model');
            }

            onProgress?.('Parsing extracted data...');

            // Extract JSON from response
            let extractedData;
            try {
                // Try to find JSON in the string
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
            // After extracting data
            console.log('Raw extracted data:', extractedData);
            console.log('Pages checked:', extractedData.pages_checked || 'Not reported');
            // Normalize the data

            const normalizedData = {
                bank_name: extractedData.bank_name || null,
                company_name: extractedData.company_name || null,
                account_number: extractedData.account_number || null,
                currency: extractedData.currency ?
                    (extractedData.currency.toUpperCase().trim() === 'KSH' ? 'KES' : extractedData.currency.toUpperCase().trim())
                    : null,
                statement_period: extractedData.statement_period || null,
                opening_balance: typeof extractedData.opening_balance === 'string'
                    ? parseCurrencyAmount(extractedData.opening_balance)
                    : extractedData.opening_balance,
                closing_balance: typeof extractedData.closing_balance === 'string'
                    ? parseCurrencyAmount(extractedData.closing_balance)
                    : extractedData.closing_balance,
                monthly_balances: []
            };

            if (extractedData.statement_period) {
                const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
                const dates = Array.from(extractedData.statement_period.matchAll(datePattern));

                if (dates.length >= 2) {
                    const startDate = new Date(parseInt(dates[0][3]), parseInt(dates[0][2]) - 1, parseInt(dates[0][1]));
                    const endDate = new Date(parseInt(dates[1][3]), parseInt(dates[1][2]) - 1, parseInt(dates[1][1]));

                    let currentDate = new Date(startDate);
                    let lastBalance = normalizedData.opening_balance || 0;

                    while (currentDate <= endDate) {
                        const month = currentDate.getMonth() + 1;
                        const year = currentDate.getFullYear();

                        const monthData = Array.isArray(extractedData.monthly_balances)
                            ? extractedData.monthly_balances.find(b => b.month === month && b.year === year)
                            : null;

                        const balance = {
                            month,
                            year,
                            opening_balance: monthData?.opening_balance || lastBalance,
                            closing_balance: monthData?.closing_balance || 0,
                            statement_page: monthData?.statement_page || 1,
                            highlight_coordinates: monthData?.highlight_coordinates || null,
                            is_verified: false,
                            verified_by: null,
                            verified_at: null,
                            opening_date: monthData?.opening_date || null,
                            closing_date: monthData?.closing_date || null
                        };

                        lastBalance = balance.closing_balance || balance.opening_balance;
                        normalizedData.monthly_balances.push(balance);

                        console.log(`Month ${year}-${month} balance:`, {
                            opening: balance.opening_balance,
                            closing: balance.closing_balance,
                            page: balance.statement_page
                        });

                        currentDate.setMonth(currentDate.getMonth() + 1);
                    }
                }
            }

            console.log('Final monthly balances:', normalizedData.monthly_balances);
            // If no monthly balances were found but we have opening/closing balance,
            // create a monthly balance entry for the requested month
            if (normalizedData.monthly_balances.length === 0 &&
                (normalizedData.opening_balance !== null || normalizedData.closing_balance !== null)) {
                normalizedData.monthly_balances.push({
                    month: params.month,
                    year: params.year,
                    opening_balance: normalizedData.opening_balance || 0,
                    closing_balance: normalizedData.closing_balance || 0,
                    statement_page: 1,
                    highlight_coordinates: null,
                    is_verified: false,
                    verified_by: null,
                    verified_at: null
                });
            }

            // Handle missing monthly balance for the requested month
            const hasRequestedMonth = normalizedData.monthly_balances.some(
                balance => balance.month === params.month && balance.year === params.year
            );

            if (!hasRequestedMonth && (normalizedData.opening_balance !== null || normalizedData.closing_balance !== null)) {
                normalizedData.monthly_balances.push({
                    month: params.month,
                    year: params.year,
                    opening_balance: normalizedData.opening_balance || 0,
                    closing_balance: normalizedData.closing_balance || 0,
                    statement_page: 1,
                    highlight_coordinates: null,
                    is_verified: false,
                    verified_by: null,
                    verified_at: null
                });
            }

            resetApiKeyStatus(API_KEYS[currentApiKeyIndex]);

            return {
                success: true,
                extractedData: normalizedData
            };

        } catch (error) {
            attempts++;
            console.error(`Extraction attempt ${attempts} failed:`, error);

            // Check for rate limit error
            if (error.message?.includes('429') || error.message?.includes('quota')) {
                markApiKeyFailure(API_KEYS[currentApiKeyIndex]);
            }

            if (attempts < MAX_ATTEMPTS) {
                onProgress?.(`Extraction failed. Trying with backup API key (Attempt ${attempts + 1}/${MAX_ATTEMPTS})...`);

                // Add a small delay before retrying
                await delay(1000);
            } else {
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
                    message: `Extraction failed after ${MAX_ATTEMPTS} attempts. Please enter the data manually.`
                };
            }
        }
    }

    // Return empty data if all attempts failed
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
        message: 'Extraction failed after all attempts. Please enter the data manually.'
    };
}

// Helper function for batch extraction of multiple statements
export async function performBatchBankStatementExtraction(
    documents: { url: string; bank_id: number; month: number; year: number }[],
    onProgress?: (message: string) => void
): Promise<Record<string, ExtractionResult>> {
    const results: Record<string, ExtractionResult> = {};

    for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        onProgress?.(`Processing document ${i + 1} of ${documents.length}...`);

        try {
            const result = await performBankStatementExtraction(
                doc.url,
                { month: doc.month, year: doc.year },
                (message) => onProgress?.(`Document ${i + 1}: ${message}`)
            );

            results[doc.bank_id.toString()] = result;
        } catch (error) {
            console.error(`Error processing document for bank ID ${doc.bank_id}:`, error);
            results[doc.bank_id.toString()] = {
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
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }

        // Add a small delay between documents to avoid rate limiting
        if (i < documents.length - 1) {
            await delay(1000);
        }
    }

    return results;
}

// Helper function to validate bank details match the expected values
export function validateBankDetails(
    expected: {
        bank_name: string;
        company_name: string;
        account_number: string;
        statement_period: string;
        currency: string;
    },
    extracted: {
        bank_name: string | null;
        company_name: string | null;
        account_number: string | null;
        statement_period: string | null;
        currency: string | null;
    }
): { isValid: boolean; mismatches: string[] } {
    const mismatches: string[] = [];

    if (extracted.bank_name && !extracted.bank_name.toLowerCase().includes(expected.bank_name.toLowerCase())) {
        mismatches.push(`Bank name mismatch: Expected "${expected.bank_name}", found "${extracted.bank_name}"`);
    }

    if (extracted.company_name && !extracted.company_name.toLowerCase().includes(expected.company_name.toLowerCase())) {
        mismatches.push(`Bank name mismatch: Expected "${expected.company_name}", found "${extracted.company_name}"`);
    }

    if (extracted.statement_period && !extracted.statement_period.toLowerCase().includes(expected.statement_period.toLowerCase())) {
        mismatches.push(`Bank name mismatch: Expected "${expected.statement_period}", found "${extracted.statement_period}"`);
    }

    if (extracted.account_number && !extracted.account_number.includes(expected.account_number)) {
        mismatches.push(`Account number mismatch: Expected "${expected.account_number}", found "${extracted.account_number}"`);
    }

    if (extracted.currency && extracted.currency !== expected.currency) {
        mismatches.push(`Currency mismatch: Expected "${expected.currency}", found "${extracted.currency}"`);
    }

    return {
        isValid: mismatches.length === 0,
        mismatches
    };
}

// Function to get the page number containing specific text
export async function findPageWithText(
    fileUrl: string,
    searchText: string,
    onProgress?: (message: string) => void
): Promise<number | null> {
    try {
        onProgress?.('Finding page containing specific text...');

        const filePart = await fileToGenerativePart(fileUrl);

        const prompt = `
      Find which page numbers in this PDF document contains the text "${searchText}".
      
      Only respond with the page number as a single digit or number.
      If the text appears on multiple pages, return the first occurrence.
      If the text is not found, return "Not found".
    `;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                ...generationConfig,
                temperature: 0
            },
        });

        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const text = response.text().trim();

        if (text === "Not found") return null;

        const pageNumber = parseInt(text);
        return isNaN(pageNumber) ? null : pageNumber;

    } catch (error) {
        console.error('Error finding page with text:', error);
        return null;
    }
}

// Function to identify coordinates for highlighting specific text on a page
export async function getHighlightCoordinates(
    fileUrl: string,
    page: number,
    searchText: string
): Promise<{ x1: number; y1: number; x2: number; y2: number; page: number } | null> {
    try {
        const filePart = await fileToGenerativePart(fileUrl);

        const prompt = `
      Look at pages ${page} of this PDF document.
      Find the exact coordinates where the text "${searchText}" appears.
      
      Return the coordinates in this exact JSON format:
      {
        "x1": top-left x coordinate,
        "y1": top-left y coordinate,
        "x2": bottom-right x coordinate,
        "y2": bottom-right y coordinate,
        "page": ${page}
      }
      
      Only return the JSON object, nothing else.
      If the text is not found, return { "found": false }.
    `;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                ...generationConfig,
                temperature: 0
            },
        });

        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from response
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                if (data.found === false) return null;

                // Validate coordinates
                if (typeof data.x1 === 'number' &&
                    typeof data.y1 === 'number' &&
                    typeof data.x2 === 'number' &&
                    typeof data.y2 === 'number') {
                    return {
                        x1: data.x1,
                        y1: data.y1,
                        x2: data.x2,
                        y2: data.y2,
                        page
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('Error parsing highlight coordinates:', error);
            return null;
        }

    } catch (error) {
        console.error('Error getting highlight coordinates:', error);
        return null;
    }
}

export async function saveExtractionResults(
    bankStatementId: string,
    extractedData: ExtractionResult['extractedData']
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('bank_statements')
            .update({
                statement_extractions: extractedData,
                validation_status: {
                    is_validated: false,
                    validation_date: new Date().toISOString(),
                    validated_by: null,
                    mismatches: []
                }
            })
            .eq('id', bankStatementId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error saving extraction results:', error);
        return false;
    }
}