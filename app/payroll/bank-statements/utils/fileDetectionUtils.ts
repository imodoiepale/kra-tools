/**
 * Utility functions for detecting information from bank statement filenames
 */

/**
 * Detects password and account number from a filename
 * @param filename The filename to analyze
 * @returns Object containing detected password and account number
 */
export function detectFileInfo(filename: string) {
    const result = {
        password: null as string | null,
        accountNumber: null as string | null
    };
    
    // Common password patterns in filenames
    const passwordPatterns = [
        /pass[_-]?(\w+)/i,
        /pwd[_-]?(\w+)/i,
        /password[_-]?(\w+)/i,
        /pw[_-]?(\w+)/i
    ];

    // Account number patterns
    const accountPatterns = [
        /acc[_-]?(\d+)/i,
        /account[_-]?(\d+)/i,
        /acct[_-]?(\d+)/i,
        /(\d{10,})/  // Matches 10 or more digits
    ];

    // Try to detect password
    for (const pattern of passwordPatterns) {
        const match = filename.match(pattern);
        if (match && match[1]) {
            result.password = match[1];
            break;
        }
    }

    // Try to detect account number
    for (const pattern of accountPatterns) {
        const match = filename.match(pattern);
        if (match && match[1]) {
            result.accountNumber = match[1];
            break;
        }
    }

    return result;
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
