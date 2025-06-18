// @ts-nocheck
import { performBankStatementExtraction } from '../bankExtractionUtils';

/**
 * Service for handling bank statement extractions with caching and optimization
 */
export class ExtractionsService {
    private static cache = new Map<string, any>();
    private static readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

    /**
     * Get extraction results with caching
     */
    static async getExtraction(
        file: File | string,
        options: {
            month?: number;
            year?: number;
            password?: string | null;
            forceAiExtraction?: boolean;
            statementId?: string;
        } = {}
    ) {
        try {
            // Generate cache key
            const cacheKey = this.generateCacheKey(file, options);

            // Check cache if not forcing extraction
            if (!options.forceAiExtraction) {
                const cached = this.getCachedResult(cacheKey);
                if (cached) {
                    console.log('Using cached extraction result');
                    return cached;
                }
            }

            // Create file URL if needed
            let fileUrl = file;
            if (file instanceof File) {
                fileUrl = URL.createObjectURL(file);
            }

            // Perform extraction
            const result = await performBankStatementExtraction(
                fileUrl,
                {
                    month: options.month || 0,
                    year: options.year || new Date().getFullYear(),
                    password: options.password
                },
                (message) => console.log('Extraction progress:', message)
            );

            // Clean up URL if we created it
            if (file instanceof File && typeof fileUrl === 'string') {
                URL.revokeObjectURL(fileUrl);
            }

            // Cache successful results
            if (result.success) {
                this.setCachedResult(cacheKey, result);
            }

            return result;

        } catch (error) {
            console.error('Error in ExtractionsService:', error);
            return {
                success: false,
                error: error.message,
                requiresPassword: false,
                extractedData: null
            };
        }
    }

    /**
     * Generate a cache key for the extraction
     */
    private static generateCacheKey(file: File | string, options: any): string {
        const fileName = file instanceof File ? file.name : file;
        const fileSize = file instanceof File ? file.size : 'unknown';
        return `${fileName}_${fileSize}_${options.month}_${options.year}_${options.password || 'none'}`;
    }

    /**
     * Get cached result if not expired
     */
    private static getCachedResult(key: string): any {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > this.CACHE_EXPIRY) {
            this.cache.delete(key);
            return null;
        }

        return cached.result;
    }

    /**
     * Cache a result with timestamp
     */
    private static setCachedResult(key: string, result: any): void {
        this.cache.set(key, {
            result,
            timestamp: Date.now()
        });
    }

    /**
     * Clear cache
     */
    static clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache stats
     */
    static getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}