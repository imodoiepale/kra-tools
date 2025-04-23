// @ts-nocheck
// lib/extractionService.ts

import { performBankStatementExtraction } from './bankExtractionUtils';

interface ExtractionOptions {
    month: number;
    year: number;
    password?: string | null;
    extractPeriodOnly?: boolean;
    [key: string]: any;
}

interface ExtractionResult {
    success: boolean;
    extractedData: any;
    error?: string;
    requiresPassword?: boolean;
}

// In-memory cache for extraction results
let extractionCache: Record<string, ExtractionResult> = {};

export const ExtractionsService = {
    /**
     * Get extraction from cache or perform new extraction
     * @param fileOrUrl - File object or URL string
     * @param options - Options for extraction
     * @returns Extraction result
     */
    async getExtraction(fileOrUrl: File | string, options: ExtractionOptions = {} as ExtractionOptions): Promise<ExtractionResult> {
        const cacheKey = this.generateCacheKey(fileOrUrl, options);

        // Check if result is in cache
        if (extractionCache[cacheKey]) {
            console.log(`Using cached extraction for ${cacheKey}`);
            return extractionCache[cacheKey];
        }

        console.log(`Performing new extraction for ${cacheKey}`, {
            fileOrUrl: typeof fileOrUrl === 'string' ? fileOrUrl : fileOrUrl.name,
            options
        });

        try {
            // Convert File to URL if needed
            const url = typeof fileOrUrl === 'string'
                ? fileOrUrl
                : URL.createObjectURL(fileOrUrl);

            // Perform the extraction
            const result = await performBankStatementExtraction(url, options);

            // Store in cache
            extractionCache[cacheKey] = result;

            // Clean up URL if we created it
            if (typeof fileOrUrl !== 'string') {
                URL.revokeObjectURL(url);
            }

            return result;
        } catch (error) {
            console.error('Extraction service error:', error);

            // Return error result but don't cache errors
            const errorResult = {
                success: false,
                extractedData: null,
                error: error instanceof Error ? error.message : 'Unknown extraction error'
            };

            return errorResult;
        }
    },

    /**
     * Generate a cache key based on file attributes and options
     * @param fileOrUrl - File object or URL string
     * @param options - Options used for extraction
     * @returns Unique cache key
     */
    generateCacheKey(fileOrUrl: File | string, options: ExtractionOptions): string {
        if (typeof fileOrUrl === 'string') {
            // For URLs, use the URL and options
            return `url-${fileOrUrl}-${JSON.stringify(options)}`;
        }

        // For files, use file metadata and options
        return `file-${fileOrUrl.name}-${fileOrUrl.size}-${fileOrUrl.lastModified}-${JSON.stringify(options)}`;
    },

    /**
     * Process multiple files in a batch
     * @param files - Array of files to process
     * @param options - Options for extraction
     * @returns Array of extraction results
     */
    async processBatch(files: File[], options: ExtractionOptions = {} as ExtractionOptions): Promise<ExtractionResult[]> {
        console.log(`Processing batch of ${files.length} files`);

        // Process files in parallel with Promise.all
        const results = await Promise.all(
            files.map(file => this.getExtraction(file, options))
        );

        return results;
    },

    /**
     * Clear specific cache entry
     * @param key - Cache key to clear
     * @returns True if entry was found and cleared
     */
    clearCache(key: string): boolean {
        if (extractionCache[key]) {
            delete extractionCache[key];
            console.log(`Cleared cache for key: ${key}`);
            return true;
        }
        console.log(`No cache found for key: ${key}`);
        return false;
    },

    /**
     * Clear all cache entries
     * @returns True after cache is cleared
     */
    clearAllCache(): boolean {
        const cacheSize = Object.keys(extractionCache).length;
        extractionCache = {};
        console.log(`Cleared all extraction cache (${cacheSize} entries)`);
        return true;
    },

    /**
     * Get cache statistics
     * @returns Cache statistics
     */
    getCacheStats(): { size: number, keys: string[] } {
        return {
            size: Object.keys(extractionCache).length,
            keys: Object.keys(extractionCache)
        };
    }
};