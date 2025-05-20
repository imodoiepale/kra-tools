// automations/pin-checker/index.js
import { processCompany } from './worker.js';
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Control parallel execution
const MAX_CONCURRENT_WORKERS = parseInt(process.env.MAX_CONCURRENT_WORKERS || '3');

// Control flag for stopping automation
let stopRequested = false;

/**
 * Run the PIN Checker automation
 * @param {string} runOption - 'all' or 'selected'
 * @param {Array} selectedIds - Array of company IDs to process (when runOption is 'selected')
 * @returns {Object} - Result of the automation
 */
export async function runPinCheckerAutomation(runOption, selectedIds) {
    console.log(`Starting PIN Checker automation with ${MAX_CONCURRENT_WORKERS} concurrent workers`);

    // Reset the stop flag
    stopRequested = false;

    // Reset automation status
    await updateAutomationProgress(0, "Starting", []);

    try {
        // Get companies to process
        const companies = await readSupabaseData(runOption, selectedIds);

        if (!companies || companies.length === 0) {
            console.log("No companies to process");
            await updateAutomationProgress(100, "Completed", []);
            return { message: "No companies to process" };
        }

        console.log(`Processing ${companies.length} companies`);

        // Process companies in batches
        const allResults = [];
        let processedCount = 0;

        // Process in batches of MAX_CONCURRENT_WORKERS
        for (let i = 0; i < companies.length && !stopRequested; i += MAX_CONCURRENT_WORKERS) {
            const batch = companies.slice(i, i + MAX_CONCURRENT_WORKERS);
            console.log(`Processing batch ${i / MAX_CONCURRENT_WORKERS + 1} with ${batch.length} companies`);

            // Process current batch in parallel
            const batchPromises = batch.map(company => processCompany(company));
            const batchResults = await Promise.all(batchPromises);

            // Update progress
            allResults.push(...batchResults);
            processedCount += batch.length;
            const progress = Math.round((processedCount / companies.length) * 100);

            console.log(`Completed ${processedCount}/${companies.length} companies (${progress}%)`);
            await updateAutomationProgress(progress, stopRequested ? "Stopped" : "Running", allResults);

            // Check if we should stop
            if (stopRequested) {
                console.log("Automation stop requested, ending after current batch");
                break;
            }
        }

        // Final status update
        const finalStatus = stopRequested ? "Stopped" : "Completed";
        const finalProgress = stopRequested ? Math.round((processedCount / companies.length) * 100) : 100;

        await updateAutomationProgress(finalProgress, finalStatus, allResults);
        console.log(`Automation ${finalStatus.toLowerCase()} after processing ${processedCount}/${companies.length} companies`);

        return {
            message: `Automation ${finalStatus.toLowerCase()}`,
            processed: processedCount,
            total: companies.length,
            results: allResults
        };
    } catch (error) {
        console.error("Error in runPinCheckerAutomation:", error);
        await updateAutomationProgress(0, "Error", [{ error: error.message }]);
        return { error: error.message };
    }
}

/**
 * Stop the PIN Checker automation
 */
export async function stopPinCheckerAutomation() {
    console.log("Stop requested for PIN Checker automation");
    stopRequested = true;
    await updateAutomationProgress(
        null, // Don't update progress percentage
        "Stopping",
        null // Don't update logs
    );
    return { message: "Stop requested" };
}

/**
 * Get the current progress of the PIN Checker automation
 * @returns {Object} - Progress object
 */
export async function getPinCheckerProgress() {
    try {
        const { data, error } = await supabase
            .from("PinCheckerDetails_AutomationProgress")
            .select("*")
            .eq("id", 1)
            .single();

        if (error) {
            console.error("Supabase error getting progress:", error);
            return { status: "Unknown", progress: 0, logs: [] };
        }

        return data || { status: "Not Started", progress: 0, logs: [] };
    } catch (error) {
        console.error("Error getting automation progress:", error);
        return { status: "Error", progress: 0, logs: [{ error: error.message }] };
    }
}

/**
 * Update the automation progress in the database
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} status - Status message
 * @param {Array} logs - Array of log objects
 */
async function updateAutomationProgress(progress, status, logs) {
    try {
        const updateObj = {
            id: 1,
            last_updated: new Date().toISOString()
        };

        // Only update fields that are provided
        if (progress !== null && progress !== undefined) {
            updateObj.progress = progress;
        }

        if (status) {
            updateObj.status = status;
        }

        if (logs) {
            updateObj.logs = logs;
        }

        await supabase
            .from("PinCheckerDetails_AutomationProgress")
            .upsert(updateObj);
    } catch (error) {
        console.error("Error updating automation progress:", error);
    }
}

/**
 * Read company data from Supabase
 * @param {string} runOption - 'all' or 'selected'
 * @param {Array} selectedIds - Array of company IDs to process (when runOption is 'selected')
 * @returns {Array} - Array of company objects
 */
async function readSupabaseData(runOption, selectedIds) {
    try {
        console.log(`Reading Supabase data for runOption: ${runOption}, with ${selectedIds?.length || 0} IDs`);

        // Always start with a base query
        let query = supabase
            .from("acc_portal_company_duplicate")
            .select("*")
            .order('id', { ascending: true });

        // Only filter by IDs if in 'selected' mode and we have IDs
        if (runOption === 'selected' && selectedIds && selectedIds.length > 0) {
            console.log(`Filtering by ${selectedIds.length} selected IDs`);
            query = query.in('id', selectedIds);
        } else {
            console.log('Running in all companies mode, no ID filtering applied');
        }

        // Execute the query
        const { data, error } = await query;

        if (error) {
            console.error(`Supabase query error: ${error.message}`);
            throw new Error(`Error reading data from companies table: ${error.message}`);
        }

        console.log(`Successfully retrieved ${data?.length || 0} companies from Supabase`);

        // Filter out companies without KRA PINs
        const filteredData = data?.filter(company => !!company.kra_pin) || [];

        if (filteredData.length < (data?.length || 0)) {
            console.log(`Filtered out ${(data?.length || 0) - filteredData.length} companies without KRA PINs`);
        }

        return filteredData;
    } catch (error) {
        console.error(`Error reading Supabase data: ${error.message}`);
        throw error;
    }
}