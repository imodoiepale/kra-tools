// @ts-nocheck
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker if in browser environment
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// Helper function to parse statement period string into month/year components
export const parseStatementPeriod = (periodString: string) => {
    if (!periodString) return null;

    console.log("Parsing statement period:", periodString);

    // Clean and normalize period string
    const normalizedPeriod = periodString.trim()
        .replace(/\s+/g, ' ')
        .replace(/\s*[\/-–—]\s*/g, ' - ');
    
    console.log("Normalized period string:", normalizedPeriod);

    // DD/MM/YYYY - DD/MM/YYYY format
    const dateRangePattern = /(\\d{1,2})[\\/\\.-](\\d{1,2})[\\/\\.-](\\d{4})\\s*[-–—]\\s*(\\d{1,2})[\\/\\.-](\\d{1,2})[\\/\\.-](\\d{4})/;
    let matches = periodString.match(dateRangePattern);
    if (matches && matches.length >= 7) {
        // For Date/Month format, months are 1-based in the raw data, convert to 1-based for internal use
        const startMonth = parseInt(matches[2], 10); // Now keeping as 1-based
        const startYear = parseInt(matches[3], 10);
        const endMonth = parseInt(matches[5], 10); // Now keeping as 1-based
        const endYear = parseInt(matches[6], 10);

        if (!isNaN(startMonth) && !isNaN(startYear) && !isNaN(endMonth) && !isNaN(endYear)) {
            console.log(`Parsed date range: ${startMonth}/${startYear} - ${endMonth}/${endYear}`);
            return { startMonth, startYear, endMonth, endYear };
        }
    }

    // Month name format (e.g., "January - July 2024")
    const monthNamePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s*[-–—]\\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(\\d{4})/i;
    matches = periodString.match(monthNamePattern);
    if (matches && matches.length >= 4) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

        const startMonthName = matches[1].toLowerCase().substring(0, 3);
        const endMonthName = matches[2].toLowerCase().substring(0, 3);
        const year = parseInt(matches[3], 10);

        const startMonth = monthNames.indexOf(startMonthName) + 1; // Now keeping as 1-based
        const endMonth = monthNames.indexOf(endMonthName) + 1; // Now keeping as 1-based

        if (startMonth >= 1 && endMonth >= 1 && !isNaN(year)) {
            console.log(`Parsed month range: ${startMonth}/${year} - ${endMonth}/${year}`);
            return { startMonth, startYear: year, endMonth, endYear: year };
        }
    }

    // Different year month name format (e.g., "January 2023 - February 2024")
    const diffYearMonthNamePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(\\d{4})\\s*[-–—]\\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(\\d{4})/i;
    matches = periodString.match(diffYearMonthNamePattern);
    if (matches && matches.length >= 5) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

        const startMonthName = matches[1].toLowerCase().substring(0, 3);
        const startYear = parseInt(matches[2], 10);
        const endMonthName = matches[3].toLowerCase().substring(0, 3);
        const endYear = parseInt(matches[4], 10);

        const startMonth = monthNames.indexOf(startMonthName) + 1; // Now keeping as 1-based
        const endMonth = monthNames.indexOf(endMonthName) + 1; // Now keeping as 1-based

        if (startMonth >= 1 && endMonth >= 1 && !isNaN(startYear) && !isNaN(endYear)) {
            console.log(`Parsed month range: ${startMonth}/${startYear} - ${endMonth}/${endYear}`);
            return { startMonth, startYear, endMonth, endYear };
        }
    }

    // MM/YYYY format (e.g., "03/2025" or "3/2025")
    const mmYyyyPattern = /(\d{1,2})[\\/\\.-](\\d{4})/;
    matches = periodString.match(mmYyyyPattern);
    if (matches && matches.length >= 3) {
        const month = parseInt(matches[1], 10);
        const year = parseInt(matches[2], 10);

        if (month >= 1 && month <= 12 && !isNaN(year)) {
            console.log(`Parsed MM/YYYY format: ${month}/${year}`);
            return { startMonth: month, startYear: year, endMonth: month, endYear: year };
        }
    }

    // Single month format (e.g., "January 2024")
    const singleMonthPattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(\\d{4})/i;
    matches = periodString.match(singleMonthPattern);
    if (matches && matches.length >= 3) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

        const monthName = matches[1].toLowerCase().substring(0, 3);
        const year = parseInt(matches[2], 10);

        const month = monthNames.indexOf(monthName) + 1; // Now keeping as 1-based

        if (month >= 1 && !isNaN(year)) {
            console.log(`Parsed single month: ${month}/${year}`);
            return { startMonth: month, startYear: year, endMonth: month, endYear: year };
        }
    }

    // Q1, Q2, Q3, Q4 format (e.g., "Q1 2024" or "Quarter 1 2024")
    const quarterPattern = /[qQ](?:uarter)?\s*(\d)\s+(\d{4})/i;
    matches = periodString.match(quarterPattern);
    if (matches && matches.length >= 3) {
        const quarter = parseInt(matches[1], 10);
        const year = parseInt(matches[2], 10);

        if (quarter >= 1 && quarter <= 4 && !isNaN(year)) {
            // Convert quarter to start/end months
            const startMonth = (quarter - 1) * 3 + 1; // Q1=1, Q2=4, Q3=7, Q4=10
            const endMonth = quarter * 3; // Q1=3, Q2=6, Q3=9, Q4=12
            
            console.log(`Parsed quarter: Q${quarter}/${year} as ${startMonth}/${year}-${endMonth}/${year}`);
            return { startMonth, startYear: year, endMonth, endYear: year };
        }
    }

    // Text-based values like "March 2025"
    try {
        // Try to parse using Date.parse logic for recognizable date patterns
        if (periodString.match(/^\w+\s+\d{4}$/)) {
            const dateObj = new Date(periodString);
            if (!isNaN(dateObj.getTime())) {
                const month = dateObj.getMonth() + 1; // Convert to 1-based
                const year = dateObj.getFullYear();
                console.log(`Parsed text date "${periodString}" as: ${month}/${year}`);
                return { startMonth: month, startYear: year, endMonth: month, endYear: year };
            }
        }
    } catch (error) {
        console.warn("Failed to parse as date:", error);
    }

    // Last resort: Try to extract just numbers that might be month/year
    const numbersInPeriod = periodString.match(/\d+/g);
    if (numbersInPeriod && numbersInPeriod.length >= 2) {
        // Assume last number is year if it's 4 digits
        const possibleYear = numbersInPeriod.find((num: string) => num.length === 4);
        const possibleMonth = numbersInPeriod.find((num: string) => parseInt(num) >= 1 && parseInt(num) <= 12);
        
        if (possibleYear && possibleMonth) {
            const month = parseInt(possibleMonth);
            const year = parseInt(possibleYear);
            console.log(`Last resort parsing: ${month}/${year}`);
            return { startMonth: month, startYear: year, endMonth: month, endYear: year };
        }
    }

    console.warn("Failed to parse period format:", periodString);
    return null;
};

// Helper function to generate month range from start to end
export const generateMonthRange = (startMonth: number, startYear: number, endMonth: number, endYear: number) => {
    console.log(`Generating month range from ${startMonth}/${startYear} to ${endMonth}/${endYear}`);
    
    // Validate inputs
    if (!startMonth || !startYear || !endMonth || !endYear) {
        console.warn("Invalid inputs to generateMonthRange:", { startMonth, startYear, endMonth, endYear });
        return [];
    }
    
    // Ensure all inputs are numbers
    startMonth = Number(startMonth);
    startYear = Number(startYear);
    endMonth = Number(endMonth);
    endYear = Number(endYear);
    
    // Handle special case where end date is before start date (cross-year statement)
    if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) {
        console.log("End date is before start date, swapping dates");
        [startMonth, startYear, endMonth, endYear] = [endMonth, endYear, startMonth, startYear];
    }
    
    const months = [];
    let currentYear = startYear;
    let currentMonth = startMonth;

    console.log(`Start loop with currentMonth=${currentMonth}, currentYear=${currentYear}`);
    
    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        months.push({
            month: currentMonth, // Keep as 1-based month throughout
            year: currentYear
        });
        
        console.log(`Added month: ${currentMonth}/${currentYear}`);

        currentMonth++;
        if (currentMonth > 12) { // Use 12 as the max month (December)
            currentMonth = 1; // Reset to January (1)
            currentYear++;
            console.log(`Rolled over to next year: ${currentMonth}/${currentYear}`);
        }
    }
    
    console.log(`Generated ${months.length} months in range`);
    return months;
};

// Format file name for display
export const formatFileName = (file: File): { shortName: string, fullName: string, extension: string } => {
    if (!file) return { shortName: 'Unknown file', fullName: 'Unknown file', extension: '' };

    const name = file.name || '';
    const lastDotIndex = name.lastIndexOf('.');

    // Handle files with no extension
    if (lastDotIndex === -1) {
        return {
            shortName: name.length > 30 ? name.substring(0, 27) + '...' : name,
            fullName: name,
            extension: ''
        };
    }

    const baseName = name.substring(0, lastDotIndex);
    const extension = name.substring(lastDotIndex + 1);

    return {
        shortName: baseName.length > 30 ? baseName.substring(0, 27) + '...' : baseName,
        fullName: name,
        extension: extension
    };
};

// Enhanced function to get bank name from filename with fuzzy matching
export const getBankNameFromFilename = (filename: string) => {
    // Convert filename to lowercase for case-insensitive matching
    const lowerFilename = filename.toLowerCase();

    // Common bank names to check
    const bankNames = [
        'kcb', 'equity', 'stanbic', 'standard chartered', 'stanchart', 'absa', 'barclays',
        'coop', 'cooperative', 'ncba', 'cba', 'diamond trust', 'dtb', 'family', 'i&m', 'im bank',
        'gulf', 'uob', 'prime', 'bank of africa', 'boa', 'credit bank', 'eco bank', 'ecobank'
    ];

    // Try to find any bank name in the filename
    for (const bank of bankNames) {
        if (lowerFilename.includes(bank)) {
            return bank;
        }
    }

    return null;
};

// Extract account number from filename
export const getAccountNumberFromFilename = (filename: string) => {
    // Look for common account number patterns
    // This regex matches sequences that look like account numbers:
    // - Groups of digits (at least 5) 
    // - May contain hyphens or spaces
    const accountNumberRegex = /[0-9]{5,}|[0-9]{2,}[-\s][0-9]{2,}[-\s][0-9]{2,}/g;
    const matches = filename.match(accountNumberRegex);

    return matches ? matches[0] : null;
};

// Detect password from filename
export const detectPasswordFromFilename = (filename: string) => {
    // Common password patterns in filenames
    // Look for patterns like "pass:1234" or "pwd1234" or "p=1234"
    const passwordRegex = /(?:pass(?:word)?[:=\s]*)(\d{4,})|(?:p(?:wd)?[:=\s]*)(\d{4,})/i;
    const match = filename.match(passwordRegex);

    if (match) {
        return match[1] || match[2] || null;
    }

    // Alternative approach: check for 4-digit numbers in filename
    // that might be passwords (simple heuristic)
    const digitMatch = filename.match(/\b\d{4}\b/);
    return digitMatch ? digitMatch[0] : null;
};

// Detect file info from filename
export const detectFileInfoFromFilename = (filename: string) => {
    if (!filename) return { password: null, accountNumber: null, bankName: null };

    // Detect password
    const password = detectPasswordFromFilename(filename);

    // Detect account number
    const accountNumber = getAccountNumberFromFilename(filename);

    // Detect bank name
    const bankName = getBankNameFromFilename(filename);

    return {
        password,
        accountNumber,
        bankName
    };
};

// Fuzzy match a bank based on filename
export const fuzzyMatchBank = (filename: string, allBanks: any[]) => {
    console.log('Attempting fuzzy match for filename:', filename);

    if (!filename || !allBanks || allBanks.length === 0) {
        return null;
    }

    // Convert filename to lowercase for case-insensitive matching
    const lowerFilename = filename.toLowerCase();

    // Extract potential bank name and account number
    const detectedBankName = getBankNameFromFilename(filename);
    const detectedAccountNumber = getAccountNumberFromFilename(filename);

    console.log('Detected in filename:', {
        bankName: detectedBankName,
        accountNumber: detectedAccountNumber
    });

    // If we have an account number, it's the strongest match
    if (detectedAccountNumber) {
        const normalizedDetectedNumber = detectedAccountNumber.replace(/[-\s]/g, '');

        // Try to find an exact match for account number
        const exactMatch = allBanks.find(bank => {
            const normalizedBankNumber = (bank.account_number || '').replace(/[-\s]/g, '');
            return normalizedBankNumber === normalizedDetectedNumber;
        });

        if (exactMatch) {
            console.log('Found exact account number match:', exactMatch);
            return exactMatch;
        }

        // Try to find a partial match (account number contains or is contained in)
        const partialMatch = allBanks.find(bank => {
            const normalizedBankNumber = (bank.account_number || '').replace(/[-\s]/g, '');
            return normalizedBankNumber.includes(normalizedDetectedNumber) ||
                normalizedDetectedNumber.includes(normalizedBankNumber);
        });

        if (partialMatch) {
            console.log('Found partial account number match:', partialMatch);
            return partialMatch;
        }
    }

    // If no match by account number, try by bank name
    if (detectedBankName) {
        const bankMatch = allBanks.find(bank =>
            bank?.bank_name?.toLowerCase().includes(detectedBankName.toLowerCase()) ||
            detectedBankName.toLowerCase().includes(bank?.bank_name?.toLowerCase() || '')
        );

        if (bankMatch) {
            console.log('Found bank name match:', bankMatch);
            return bankMatch;
        }
    }

    // If all else fails, look for any overlap between filename and bank/company name
    for (const bank of allBanks) {
        const bankNameLower = (bank.bank_name || '').toLowerCase();
        const companyNameLower = (bank.company_name || '').toLowerCase();

        if (bankNameLower && lowerFilename.includes(bankNameLower)) {
            console.log('Found bank name in filename match:', bank);
            return bank;
        }

        if (companyNameLower && lowerFilename.includes(companyNameLower)) {
            console.log('Found company name in filename match:', bank);
            return bank;
        }
    }

    console.log('No matches found for file:', filename);
    return null;
};

// Check if PDF is password protected
export const isPdfPasswordProtected = async (file: File): Promise<boolean> => {
    try {
        // Create a temporary URL for the file
        const url = URL.createObjectURL(file);

        try {
            // Try to load the document
            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;

            // If we can load it without exception, it's not password protected
            await pdf.getPage(1);

            // Clean up
            pdf.destroy();
            return false;
        } catch (error) {
            // Check for password errors
            if (
                error.name === 'PasswordException' ||
                error.message.includes('password') ||
                error.message.includes('Password')
            ) {
                return true;
            }

            // Other errors, rethrow
            throw error;
        } finally {
            // Always revoke the URL when done
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Error checking if PDF is password protected:', error);
        // If we can't determine, assume it might be password protected
        return true;
    }
};

// Apply password to PDF file
export const applyPasswordToFiles = async (file: File, password: string): Promise<boolean> => {
    try {
        // Create a temporary URL for the file
        const url = URL.createObjectURL(file);

        try {
            // Try to load with password
            const loadingTask = pdfjsLib.getDocument({
                url,
                password,
            });
            const pdf = await loadingTask.promise;

            // Try to access page 1 to verify access
            await pdf.getPage(1);

            // Clean up
            pdf.destroy();
            return true;
        } catch (error) {
            // Password didn't work
            console.log('Password incorrect or other error:', error.message);
            return false;
        } finally {
            // Always revoke the URL when done
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Error applying password to PDF:', error);
        return false;
    }
};

// Format file size utility function
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Check if period is contained within a given month/year
export const isPeriodContained = (statementPeriod: string, cycleMonth: number, cycleYear: number): boolean => {
    if (!statementPeriod) return false;

    const monthYearRegex = new RegExp(`\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+${cycleYear}\\b`, 'i');
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

    if (monthYearRegex.test(statementPeriod)) {
        const normalizedPeriod = statementPeriod.toLowerCase();
        const cycleMonthName = monthNames[cycleMonth];
        return normalizedPeriod.includes(cycleMonthName);
    }

    try {
        // If there's a date range format (e.g., "01/01/2024 - 30/01/2024")
        const dates = statementPeriod.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g);
        if (!dates || dates.length < 2) return false;

        const parseDate = (dateStr: string) => {
            const parts = dateStr.split(/[\/\-\.]/);
            if (parts.length !== 3) return null;

            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                return { day, month, year };
            }

            const day2 = parseInt(parts[1], 10);
            const month2 = parseInt(parts[0], 10);

            if (day2 >= 1 && day2 <= 31 && month2 >= 1 && month2 <= 12) {
                return { day: day2, month: month2, year };
            }

            return null;
        };

        const startDate = parseDate(dates[0]);
        const endDate = parseDate(dates[1]);

        if (!startDate || !endDate) return false;

        if (startDate.year < cycleYear && endDate.year > cycleYear) return true;
        if (endDate.year < cycleYear || startDate.year > cycleYear) return false;

        if (startDate.year === cycleYear && cycleMonth < startDate.month) return false;
        if (endDate.year === cycleYear && cycleMonth > endDate.month) return false;

        return true;
    } catch (error) {
        console.error('Error validating statement period:', error);
        return false;
    }
};

// Normalize currency code
export const normalizeCurrencyCode = (code: string | null): string => {
    if (!code) return 'USD';

    const upperCode = code.toUpperCase().trim();
    const currencyMap: Record<string, string> = {
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
        'SH': 'KES',
        'KES': 'KES'
    };

    return currencyMap[upperCode] || upperCode;
};

// Validate extracted data against bank info
export const validateExtractedData = (extractedData: any, bank: any) => {
    // Add comprehensive logging to debug validation issues
    console.log("validateExtractedData called with:", {
        extractedData: extractedData || "No data",
        bank: bank || "No bank",
        extractedDataType: typeof extractedData,
        bankType: typeof bank
    });

    const mismatches: string[] = [];

    if (!extractedData || !bank) {
        return { isValid: false, mismatches: ['No extracted data or bank match'] };
    }

    // Check company name
    if (bank?.company_name && 
        (!extractedData?.company_name || 
         !extractedData.company_name.toLowerCase().includes(bank.company_name.toLowerCase()))) {
        mismatches.push('Company name mismatch');
    }

    // Check bank name - special handling for "Not Available" or "Not available in text"
    if (bank?.bank_name && 
        extractedData?.bank_name && 
        extractedData.bank_name !== "Not Available" &&
        extractedData.bank_name !== "Not available in text" &&
        !extractedData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())) {
        mismatches.push('Bank name mismatch');
    }

    // Check account number
    if (bank?.account_number && 
        extractedData?.account_number && 
        !extractedData.account_number.includes(bank.account_number) &&
        !bank.account_number.includes(extractedData.account_number)) {
        mismatches.push('Account number mismatch');
    }

    // Check currency
    if (extractedData?.currency && bank?.bank_currency) {
        const normalizedExtractedCurrency = normalizeCurrencyCode(extractedData.currency);
        const normalizedBankCurrency = normalizeCurrencyCode(bank.bank_currency);

        if (normalizedExtractedCurrency !== normalizedBankCurrency) {
            mismatches.push('Currency mismatch');
        }
    }

    // Check statement period
    if (extractedData?.statement_period) {
        const cycleMonth = extractedData.statement_month || new Date().getMonth() + 1; // Use current month if not specified
        const cycleYear = extractedData.statement_year || new Date().getFullYear();

        console.log("Checking period containment:", {
            period: extractedData.statement_period,
            cycleMonth,
            cycleYear
        });

        const periodContainsExpectedMonth = isPeriodContained(
            extractedData.statement_period,
            cycleMonth,
            cycleYear
        );

        if (!periodContainsExpectedMonth) {
            mismatches.push('Statement period mismatch');
        }
    }

    // For debugging - log the validation result
    const result = {
        isValid: mismatches.length === 0,
        mismatches
    };
    console.log("Validation result:", result);
    
    return result;
};