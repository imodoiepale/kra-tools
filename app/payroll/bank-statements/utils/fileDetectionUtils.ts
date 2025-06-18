/**
 * Enhanced utility functions for detecting information from bank statement filenames
 */

/**
 * Detects password, account number, and bank name from a filename
 * @param filename The filename to analyze
 * @returns Object containing detected information
 */
export function detectFileInfo(filename: string) {
    const result = {
        password: null as string | null,
        accountNumber: null as string | null,
        bankName: null as string | null
    };

    // Enhanced password patterns
    const passwordPatterns = [
        /pass(?:word)?[_\-\s]*[:\=]?\s*(\w+)/i,
        /pwd[_\-\s]*[:\=]?\s*(\w+)/i,
        /p[_\-\s]*[:\=]?\s*(\d{4,})/i,
        /pw[_\-\s]*[:\=]?\s*(\w+)/i,
        /\b(\d{4})\b/  // Simple 4-digit password fallback
    ];

    // Enhanced account number patterns
    const accountPatterns = [
        /acc(?:ount)?[_\-\s]*[:\=]?\s*(\d{5,})/i,
        /acct[_\-\s]*[:\=]?\s*(\d{5,})/i,
        /\b(\d{10,})\b/,  // 10+ digit sequences
        /[_\-](\d{5,})[_\-]/  // Numbers between separators
    ];

    // Enhanced bank name patterns
    const bankPatterns = [
        { pattern: /equity/i, name: "Equity Bank" },
        { pattern: /kcb/i, name: "KCB Bank" },
        { pattern: /cooperative|coop/i, name: "Cooperative Bank" },
        { pattern: /stanchart|standard[\s\-]?chartered/i, name: "Standard Chartered" },
        { pattern: /absa/i, name: "ABSA Bank" },
        { pattern: /dtb|diamond[\s\-]?trust/i, name: "Diamond Trust Bank" },
        { pattern: /ncba/i, name: "NCBA Bank" },
        { pattern: /family/i, name: "Family Bank" },
        { pattern: /stanbic/i, name: "Stanbic Bank" },
        { pattern: /im|i&m/i, name: "I&M Bank" },
        { pattern: /gulf/i, name: "Gulf African Bank" },
        { pattern: /uob/i, name: "UOB Bank" },
        { pattern: /prime/i, name: "Prime Bank" },
        { pattern: /bank\s*of\s*africa|boa/i, name: "Bank of Africa" },
        { pattern: /credit\s*bank/i, name: "Credit Bank" },
        { pattern: /eco\s*bank|ecobank/i, name: "Ecobank" }
    ];

    // Detect password
    for (const pattern of passwordPatterns) {
        const match = filename.match(pattern);
        if (match && match[1]) {
            result.password = match[1];
            break;
        }
    }

    // Detect account number
    for (const pattern of accountPatterns) {
        const match = filename.match(pattern);
        if (match && match[1]) {
            result.accountNumber = match[1];
            break;
        }
    }

    // Detect bank name
    for (const { pattern, name } of bankPatterns) {
        if (pattern.test(filename)) {
            result.bankName = name;
            break;
        }
    }

    return result;
}

/**
 * Validates if detected information matches bank data
 */
export function validateDetectedInfo(
    detectedAccountNumber: string | null,
    detectedPassword: string | null,
    bank: { account_number: string; acc_password?: string }
): { accountMatch: boolean; passwordMatch: boolean } {
    const accountMatch = detectedAccountNumber ?
        bank.account_number.includes(detectedAccountNumber) ||
        detectedAccountNumber.includes(bank.account_number) : false;

    const passwordMatch = detectedPassword && bank.acc_password ?
        detectedPassword === bank.acc_password : false;

    return { accountMatch, passwordMatch };
}

/**
 * Validates if a detected account number matches a bank's account number
 * @param detectedAccountNumber The detected account number
 * @param bankAccountNumber The bank's account number
 * @returns True if the account numbers match or are similar
 */
export function validateAccountNumber(detectedAccountNumber: string | null, bankAccountNumber: string): boolean {
    if (!detectedAccountNumber) return false;

    // Direct match
    if (detectedAccountNumber === bankAccountNumber) return true;

    // Check if one contains the other (for partial matches)
    if (detectedAccountNumber.includes(bankAccountNumber) ||
        bankAccountNumber.includes(detectedAccountNumber)) {
        return true;
    }

    // Remove spaces and special characters for comparison
    const cleanDetected = detectedAccountNumber.replace(/[^0-9]/g, '');
    const cleanBank = bankAccountNumber.replace(/[^0-9]/g, '');

    if (cleanDetected === cleanBank) return true;
    if (cleanDetected.includes(cleanBank) || cleanBank.includes(cleanDetected)) return true;

    return false;
}

/**
 * Validates if a detected password matches a bank's password
 * @param detectedPassword The detected password
 * @param bankPassword The bank's password
 * @returns True if the passwords match
 */
export function validatePassword(detectedPassword: string | null, bankPassword: string | null): boolean {
    if (!detectedPassword || !bankPassword) return false;
    return detectedPassword === bankPassword;
}

/**
 * Advanced filename parsing for complex patterns
 * @param filename The filename to parse
 * @returns Enhanced detection results
 */
export function parseFilenameAdvanced(filename: string) {
    const basicInfo = detectFileInfo(filename);

    // Additional parsing for complex patterns
    const result = {
        ...basicInfo,
        detectedPatterns: [] as string[],
        confidence: 0
    };

    // Calculate confidence score
    let confidence = 0;
    if (result.password) confidence += 30;
    if (result.accountNumber) confidence += 40;
    if (result.bankName) confidence += 30;

    result.confidence = confidence;

    return result;
}