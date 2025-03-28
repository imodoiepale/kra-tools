import { parse, format, isValid } from 'date-fns';

export const formatDateForDisplay = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';

    try {
        // Try parsing various formats
        let date: Date | null = null;

        // Try ISO format
        date = new Date(dateString);
        if (isValid(date)) {
            return format(date, 'dd/MM/yyyy');
        }

        // Try DD/MM/YYYY format
        date = parse(dateString, 'dd/MM/yyyy', new Date());
        if (isValid(date)) {
            return format(date, 'dd/MM/yyyy');
        }

        // Try DD-MM-YYYY format
        date = parse(dateString, 'dd-MM-yyyy', new Date());
        if (isValid(date)) {
            return format(date, 'dd/MM/yyyy');
        }

        // Try YYYY-MM-DD format
        date = parse(dateString, 'yyyy-MM-dd', new Date());
        if (isValid(date)) {
            return format(date, 'dd/MM/yyyy');
        }

        return dateString; // Return original if no format matches
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString; // Return original on error
    }
};

export const formatDateForSubmission = (dateString: string | null | undefined): string => {
    if (!dateString) return '';

    try {
        // Try parsing various formats
        let date: Date | null = null;

        // Try DD/MM/YYYY format
        date = parse(dateString, 'dd/MM/yyyy', new Date());
        if (isValid(date)) {
            return format(date, 'yyyy-MM-dd');
        }

        // Try DD-MM-YYYY format
        date = parse(dateString, 'dd-MM-yyyy', new Date());
        if (isValid(date)) {
            return format(date, 'yyyy-MM-dd');
        }

        // Try ISO format
        date = new Date(dateString);
        if (isValid(date)) {
            return format(date, 'yyyy-MM-dd');
        }

        return dateString; // Return original if no format matches
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString; // Return original on error
    }
};

export const isValidDate = (dateString: string): boolean => {
    if (!dateString) return false;

    try {
        // Try various formats
        // DD/MM/YYYY
        let date = parse(dateString, 'dd/MM/yyyy', new Date());
        if (isValid(date)) return true;

        // DD-MM-YYYY
        date = parse(dateString, 'dd-MM-yyyy', new Date());
        if (isValid(date)) return true;

        // YYYY-MM-DD
        date = parse(dateString, 'yyyy-MM-dd', new Date());
        if (isValid(date)) return true;

        // ISO format
        date = new Date(dateString);
        return isValid(date);
    } catch {
        return false;
    }
};