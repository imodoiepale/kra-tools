// utils/bankStatementUtils.ts

export interface StatementPeriod {
    startMonth: number;
    startYear: number;
    endMonth: number;
    endYear: number;
}

export interface ValidationResult {
    isValid: boolean;
    mismatches: string[];
    extractedData: any;
}

/**
 * Parse statement period string into structured data
 * @param period - Period string like "January 2024 - March 2024" or "January 2024"
 * @returns Parsed period object or null if parsing fails
 */
export const parseStatementPeriod = (period: string): StatementPeriod | null => {
    if (!period) return null;

    const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];

    // Handle different period formats
    const patterns = [
        /(\w+)\s+(\d{4})\s*[-–—]\s*(\w+)\s+(\d{4})/i, // "January 2024 - March 2024"
        /(\w+)\s*[-–—]\s*(\w+)\s+(\d{4})/i, // "January - March 2024"
        /(\w+)\s+(\d{4})/i, // "January 2024"
        /(\d{1,2})\/(\d{4})\s*[-–—]\s*(\d{1,2})\/(\d{4})/i, // "01/2024 - 03/2024"
        /(\d{1,2})\/(\d{4})/i // "01/2024"
    ];

    for (const pattern of patterns) {
        const match = period.match(pattern);
        if (match) {
            if (match.length === 5 && isNaN(Number(match[1]))) {
                // Range format: "January 2024 - March 2024"
                const startMonth = monthNames.indexOf(match[1].toLowerCase()) + 1;
                const startYear = parseInt(match[2]);
                const endMonth = monthNames.indexOf(match[3].toLowerCase()) + 1;
                const endYear = parseInt(match[4]);

                if (startMonth > 0 && endMonth > 0) {
                    return { startMonth, startYear, endMonth, endYear };
                }
            } else if (match.length === 4 && isNaN(Number(match[1]))) {
                // Range format: "January - March 2024"
                const startMonth = monthNames.indexOf(match[1].toLowerCase()) + 1;
                const endMonth = monthNames.indexOf(match[2].toLowerCase()) + 1;
                const year = parseInt(match[3]);

                if (startMonth > 0 && endMonth > 0) {
                    return { startMonth, startYear: year, endMonth, endYear: year };
                }
            } else if (match.length === 3 && isNaN(Number(match[1]))) {
                // Single month format: "January 2024"
                const month = monthNames.indexOf(match[1].toLowerCase()) + 1;
                const year = parseInt(match[2]);

                if (month > 0) {
                    return { startMonth: month, startYear: year, endMonth: month, endYear: year };
                }
            } else if (match.length === 5 && !isNaN(Number(match[1]))) {
                // Numeric range format: "01/2024 - 03/2024"
                const startMonth = parseInt(match[1]);
                const startYear = parseInt(match[2]);
                const endMonth = parseInt(match[3]);
                const endYear = parseInt(match[4]);

                if (startMonth >= 1 && startMonth <= 12 && endMonth >= 1 && endMonth <= 12) {
                    return { startMonth, startYear, endMonth, endYear };
                }
            } else if (match.length === 3 && !isNaN(Number(match[1]))) {
                // Single numeric format: "01/2024"
                const month = parseInt(match[1]);
                const year = parseInt(match[2]);

                if (month >= 1 && month <= 12) {
                    return { startMonth: month, startYear: year, endMonth: month, endYear: year };
                }
            }
        }
    }

    return null;
};

/**
 * Generate array of months between start and end dates
 * @param startMonth - Starting month (1-12)
 * @param startYear - Starting year
 * @param endMonth - Ending month (1-12)
 * @param endYear - Ending year
 * @returns Array of month/year objects
 */
export const generateMonthRange = (
    startMonth: number,
    startYear: number,
    endMonth: number,
    endYear: number
): Array<{ month: number; year: number }> => {
    const months = [];
    let currentMonth = startMonth;
    let currentYear = startYear;

    // Prevent infinite loops
    const maxIterations = 120; // 10 years max
    let iterations = 0;

    while ((currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) && iterations < maxIterations) {
        months.push({ month: currentMonth, year: currentYear });

        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
        iterations++;
    }

    return months;
};

/**
 * Normalize currency codes to standard format
 * @param code - Currency code to normalize
 * @returns Normalized currency code
 */
export const normalizeCurrencyCode = (code: string | null | undefined): string => {
    if (!code) return '';

    const upperCode = code.toUpperCase().trim();

    // Common currency mappings
    const currencyMap: { [key: string]: string } = {
        // Euro variations
        'EURO': 'EUR',
        'EUROS': 'EUR',
        'EUROPEAN UNION EURO': 'EUR',

        // USD variations
        'US DOLLAR': 'USD',
        'US DOLLARS': 'USD',
        'USDOLLAR': 'USD',
        'DOLLAR': 'USD',
        'DOLLARS': 'USD',
        'UNITED STATES DOLLAR': 'USD',

        // GBP variations
        'POUND': 'GBP',
        'POUNDS': 'GBP',
        'STERLING': 'GBP',
        'BRITISH POUND': 'GBP',
        'POUND STERLING': 'GBP',

        // KES variations
        'KENYA SHILLING': 'KES',
        'KENYA SHILLINGS': 'KES',
        'KENYAN SHILLING': 'KES',
        'KENYAN SHILLINGS': 'KES',
        'KSH': 'KES',
        'K.SH': 'KES',
        'KSHS': 'KES',
        'K.SHS': 'KES',
        'SH': 'KES',
        'SHILLING': 'KES',
        'SHILLINGS': 'KES'
    };

    return currencyMap[upperCode] || upperCode;
};

/**
 * Detect password from filename using various patterns
 * @param filename - Filename to analyze
 * @returns Detected password or null
 */
export const detectPasswordFromFilename = (filename: string): string | null => {
    if (!filename) return null;

    const lowerFilename = filename.toLowerCase();

    // Common password indicators in bank statement filenames
    const passwordIndicators = [
        'password', 'passcode', 'pass', 'pwd', 'pw',
        'p w', 'p-w', 'p_w', 'pswd', 'pword'
    ];

    // Try each indicator
    for (const indicator of passwordIndicators) {
        const indicatorIndex = lowerFilename.indexOf(indicator);

        if (indicatorIndex !== -1) {
            // Get text after the indicator
            const afterIndicator = filename.substring(indicatorIndex + indicator.length).trim();

            // Extract the number/password (looking for sequences of digits)
            const passwordMatch = afterIndicator.match(/^[\s\-_:=]*([0-9]+)/);

            if (passwordMatch && passwordMatch[1]) {
                return passwordMatch[1];
            }
        }
    }

    // Also check for account numbers that might be passwords
    // This handles cases where files are named with account numbers at the end
    const accountMatch = filename.match(/\b(\d{6,12})\b(?![.\w])/);
    if (accountMatch) {
        return accountMatch[1];
    }

    // Check for 4-6 digit numbers that might be passwords (simple heuristic)
    const digitMatch = filename.match(/\b\d{4,6}\b/);
    return digitMatch ? digitMatch[0] : null;
};

/**
 * Extract bank name from filename using fuzzy matching
 * @param filename - Filename to analyze
 * @returns Detected bank name or null
 */
export const getBankNameFromFilename = (filename: string): string | null => {
    if (!filename) return null;

    const lowerFilename = filename.toLowerCase();

    // Common bank names to check (ordered by specificity)
    const bankNames = [
        'standard chartered', 'stanchart', 'scb',
        'diamond trust', 'dtb',
        'i&m bank', 'im bank', 'i&m',
        'bank of africa', 'boa',
        'cooperative bank', 'coop bank', 'cooperative', 'coop',
        'equity bank', 'equity',
        'kcb bank', 'kcb',
        'stanbic bank', 'stanbic',
        'absa bank', 'absa',
        'barclays bank', 'barclays',
        'ncba bank', 'ncba',
        'cba bank', 'cba',
        'family bank', 'family',
        'gulf african bank', 'gulf',
        'united bank for africa', 'uba',
        'prime bank', 'prime',
        'credit bank', 'credit',
        'eco bank', 'ecobank'
    ];

    // Try to find any bank name in the filename
    for (const bank of bankNames) {
        if (lowerFilename.includes(bank)) {
            return bank;
        }
    }

    return null;
};

/**
 * Extract account number from filename using patterns
 * @param filename - Filename to analyze
 * @returns Detected account number or null
 */
export const getAccountNumberFromFilename = (filename: string): string | null => {
    if (!filename) return null;

    // Look for common account number patterns
    // This regex matches sequences that look like account numbers:
    // - Groups of digits (at least 5) 
    // - May contain hyphens or spaces
    const accountNumberRegex = /[0-9]{5,}|[0-9]{2,}[-\s][0-9]{2,}[-\s][0-9]{2,}/g;
    const matches = filename.match(accountNumberRegex);

    return matches ? matches[0] : null;
};

/**
 * Validate extracted data against expected bank information
 * @param extractedData - Data extracted from statement
 * @param expectedBank - Expected bank information for validation
 * @returns Validation result with issues and status
 */
export const validateExtractedData = (extractedData: any, expectedBank?: any): ValidationResult => {
    const mismatches: string[] = [];

    if (!extractedData) {
        return {
            isValid: false,
            mismatches: ['No data extracted from statement'],
            extractedData: null
        };
    }

    // Check for essential fields
    if (!extractedData.bank_name) {
        mismatches.push('Bank name not found in statement');
    }

    if (!extractedData.account_number) {
        mismatches.push('Account number not found in statement');
    }

    if (!extractedData.currency) {
        mismatches.push('Currency not found in statement');
    }

    // If we have expected bank, validate against it
    if (expectedBank) {
        // Bank name validation
        if (extractedData.bank_name) {
            const extractedBankLower = extractedData.bank_name.toLowerCase();
            const expectedBankLower = expectedBank.bank_name.toLowerCase();

            // Check if either contains the other (flexible matching)
            if (!extractedBankLower.includes(expectedBankLower) &&
                !expectedBankLower.includes(extractedBankLower)) {
                mismatches.push(
                    `Bank name mismatch: Expected "${expectedBank.bank_name}", found "${extractedData.bank_name}"`
                );
            }
        }

        // Account number validation
        if (extractedData.account_number) {
            const cleanExtracted = extractedData.account_number.replace(/[\s\-\.]/g, '');
            const cleanExpected = expectedBank.account_number.replace(/[\s\-\.]/g, '');

            if (!cleanExtracted.includes(cleanExpected) && !cleanExpected.includes(cleanExtracted)) {
                mismatches.push(
                    `Account number mismatch: Expected "${expectedBank.account_number}", found "${extractedData.account_number}"`
                );
            }
        }

        // Currency validation
        if (extractedData.currency) {
            const normalizedExtracted = normalizeCurrencyCode(extractedData.currency);
            const normalizedExpected = normalizeCurrencyCode(expectedBank.bank_currency);

            if (normalizedExtracted !== normalizedExpected) {
                mismatches.push(
                    `Currency mismatch: Expected "${expectedBank.bank_currency}", found "${extractedData.currency}"`
                );
            }
        }
    }

    return {
        isValid: mismatches.length === 0,
        mismatches,
        extractedData
    };
};

/**
 * Format currency amount for display
 * @param amount - Numeric amount
 * @param currency - Currency code
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number | null, currency: string = 'KES'): string => {
    if (amount === null || amount === undefined) return '-';

    const normalizedCurrency = normalizeCurrencyCode(currency);

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: normalizedCurrency || 'KES',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

/**
 * Parse currency amount from string
 * @param value - String value to parse
 * @returns Numeric amount or null
 */
export const parseCurrencyAmount = (value: string | number | null): number | null => {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') return value;

    // Remove currency symbols, commas, and spaces
    const cleanValue = value.toString()
        .replace(/[^\d.-]/g, '')
        .replace(/,/g, '');

    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? null : parsed;
};

/**
 * Get month name from number
 * @param month - Month number (1-12)
 * @returns Month name
 */
export const getMonthName = (month: number): string => {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return months[month - 1] || 'Invalid Month';
};

/**
 * Check if a period spans multiple months
 * @param period - Statement period string
 * @returns True if multi-month, false otherwise
 */
export const isMultiMonthPeriod = (period: string): boolean => {
    const parsed = parseStatementPeriod(period);
    if (!parsed) return false;

    return parsed.startMonth !== parsed.endMonth || parsed.startYear !== parsed.endYear;
};

/**
 * Generate a display-friendly period string
 * @param startMonth - Start month (1-12)
 * @param startYear - Start year
 * @param endMonth - End month (1-12)
 * @param endYear - End year
 * @returns Formatted period string
 */
export const formatPeriodDisplay = (
    startMonth: number,
    startYear: number,
    endMonth?: number,
    endYear?: number
): string => {
    if (!endMonth || !endYear || (startMonth === endMonth && startYear === endYear)) {
        return `${getMonthName(startMonth)} ${startYear}`;
    }

    if (startYear === endYear) {
        return `${getMonthName(startMonth)} - ${getMonthName(endMonth)} ${startYear}`;
    }

    return `${getMonthName(startMonth)} ${startYear} - ${getMonthName(endMonth)} ${endYear}`;
};