import express from 'express';
import cors from 'cors';
import { downloadCompanyReports } from './WinguAppsStatutoryExtractor.mjs';
import { fileCompanyReturns } from './WinguAppsFilingAutomation.mjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local file
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const app = express();
const port = process.env.PORT || 3005;

// Initialize Supabase client
let supabase;

// In-memory status storage
const extractionStatus = {};
const filingStatus = {};

// Middleware
app.use(cors());
app.use(express.json());

// Debug endpoint to check server status
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'not configured',
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'not configured'
    });
});

// Health check endpoint for compatibility
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Extraction server is running'
    });
});

// Status endpoint
app.get('/api/status/:companyId', (req, res) => {
    const { companyId } = req.params;
    
    if (!extractionStatus[companyId]) {
        return res.status(404).json({ error: 'No extraction status found for this company' });
    }
    
    res.json(extractionStatus[companyId]);
});

// Status endpoint for filing
app.get('/api/filing-status/:companyId', (req, res) => {
    const { companyId } = req.params;
    
    if (!filingStatus[companyId]) {
        return res.status(404).json({ error: 'No filing status found for this company' });
    }
    
    res.json(filingStatus[companyId]);
});

// Extract endpoint
app.post('/api/extract', async (req, res) => {
    console.log('Received extraction request');
    
    try {
        const { companies, monthYear, month, year, supabaseUrl, supabaseKey, credentials } = req.body;
        
        if (!companies || !Array.isArray(companies) || companies.length === 0) {
            return res.status(400).json({ error: 'No companies provided for extraction' });
        }
        
        console.log(`Processing ${companies.length} companies`);
        console.log('Companies:', companies.map(c => c.name));
        console.log('Period:', monthYear, `(Month: ${month}, Year: ${year})`);
        
        // Initialize extraction status for each company
        companies.forEach(company => {
            extractionStatus[company.id] = {
                status: 'queued',
                progress: 0,
                startTime: new Date().toISOString(),
                company: company.name,
                monthYear,
                month,
                year
            };
        });
        
        // Send response immediately
        res.json({
            message: 'Extraction process started',
            companies: companies.map(c => c.id)
        });
        
        // Process companies in parallel
        const extractionPromises = companies.map(async (company) => {
            try {
                extractionStatus[company.id].status = 'processing';
                
                // Define progress callback
                const onProgress = (progress) => {
                    extractionStatus[company.id].progress = progress;
                };
                
                // Use provided Supabase credentials or fall back to environment variables
                const supabaseUrlToUse = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
                const supabaseKeyToUse = supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
                
                // Initialize Supabase if not already done
                if (supabaseUrlToUse && supabaseKeyToUse && !supabase) {
                    console.log('Initializing Supabase client');
                    supabase = createClient(supabaseUrlToUse, supabaseKeyToUse);
                }
                
                // Start extraction for this company
                console.log(`Starting extraction for ${company.name}`);
                await downloadCompanyReports({
                    companies: [company],
                    monthYear,
                    month,
                    year,
                    onProgress,
                    supabaseUrl: supabaseUrlToUse,
                    supabaseKey: supabaseKeyToUse,
                    credentials
                });
                
                // Update status on completion
                extractionStatus[company.id].status = 'completed';
                extractionStatus[company.id].completedAt = new Date().toISOString();
                console.log(`Completed extraction for ${company.name}`);
                
                // Update the database with extraction status
                if (supabaseUrlToUse && supabaseKeyToUse && company.company_id) {
                    try {
                        const supabaseClient = createClient(supabaseUrlToUse, supabaseKeyToUse);
                        
                        // Get current status
                        const { data: records, error: fetchError } = await supabaseClient
                            .from('company_payroll_records')
                            .select('id, status')
                            .eq('company_id', company.company_id);
                            
                        if (fetchError) {
                            console.error(`Error fetching current status for ${company.name}:`, fetchError);
                        } else if (!records || records.length === 0) {
                            console.error(`No records found for ${company.name}`);
                        } else {
                            // Find the record that matches the company's ID
                            const currentRecord = records.find(record => record.id === company.id) || records[0];
                            
                            // Update with new status
                            const { error: updateError } = await supabaseClient
                                .from('company_payroll_records')
                                .update({
                                    status: {
                                        ...(currentRecord.status || {}),
                                        extracted: true,
                                        wingu_extraction: true,
                                        extraction_date: new Date().toISOString()
                                    }
                                })
                                .eq('id', currentRecord.id);
                                
                            if (updateError) {
                                console.error(`Error updating status for ${company.name}:`, updateError);
                            } else {
                                console.log(`Updated database status for ${company.name}`);
                            }
                        }
                    } catch (dbError) {
                        console.error(`Database error for ${company.name}:`, dbError);
                    }
                }
                
            } catch (error) {
                console.error(`Error extracting for ${company.name}:`, error);
                extractionStatus[company.id].status = 'failed';
                extractionStatus[company.id].error = error.message;
                extractionStatus[company.id].completedAt = new Date().toISOString();
                
                // Update the database with failed extraction status
                if (supabaseUrlToUse && supabaseKeyToUse && company.company_id) {
                    try {
                        const supabaseClient = createClient(supabaseUrlToUse, supabaseKeyToUse);
                        
                        // Get current status
                        const { data: records, error: fetchError } = await supabaseClient
                            .from('company_payroll_records')
                            .select('id, status')
                            .eq('company_id', company.company_id);
                            
                        if (fetchError) {
                            console.error(`Error fetching current status for ${company.name}:`, fetchError);
                        } else if (!records || records.length === 0) {
                            console.error(`No records found for ${company.name}`);
                        } else {
                            // Find the record that matches the company's ID
                            const currentRecord = records.find(record => record.id === company.id) || records[0];
                            
                            // Update with failed status
                            const { error: updateError } = await supabaseClient
                                .from('company_payroll_records')
                                .update({
                                    status: {
                                        ...(currentRecord.status || {}),
                                        extraction_error: error.message,
                                        extraction_failed: true,
                                        extraction_attempt_date: new Date().toISOString()
                                    }
                                })
                                .eq('id', currentRecord.id);
                                
                            if (updateError) {
                                console.error(`Error updating failed status for ${company.name}:`, updateError);
                            } else {
                                console.log(`Updated database with failed status for ${company.name}`);
                            }
                        }
                    } catch (dbError) {
                        console.error(`Database error for ${company.name}:`, dbError);
                    }
                }
            }
        });
        
        // Process all companies
        await Promise.all(extractionPromises);
        console.log('All extractions completed');
        
    } catch (error) {
        console.error('Error in extraction process:', error);
        // We've already sent the response, so we can't send an error response here
    }
});

// Filing endpoint
app.post('/api/file', async (req, res) => {
    console.log('Received filing request');
    
    try {
        const { companies, monthYear, filingDate, supabaseUrl, supabaseKey, credentials } = req.body;
        
        if (!companies || !Array.isArray(companies) || companies.length === 0) {
            return res.status(400).json({ error: 'No companies provided for filing' });
        }
        
        console.log(`Processing ${companies.length} companies for filing`);
        console.log('Companies:', companies.map(c => c.name));
        console.log('Period:', monthYear);
        console.log('Filing Date:', filingDate);
        
        // Initialize filing status for each company
        companies.forEach(company => {
            filingStatus[company.id] = {
                status: 'queued',
                progress: 0,
                startTime: new Date().toISOString(),
                company: company.name,
                monthYear,
                filingDate
            };
        });
        
        // Send response immediately
        res.json({
            message: 'Filing process started',
            companies: companies.map(c => c.id)
        });
        
        // Define progress callback
        const onProgress = (companyId, status) => {
            filingStatus[companyId] = {
                ...filingStatus[companyId],
                ...status
            };
        };
        
        // Use provided Supabase credentials or fall back to environment variables
        const supabaseUrlToUse = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKeyToUse = supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        // Initialize Supabase client if not already done
        if (!supabase) {
            supabase = createClient(supabaseUrlToUse, supabaseKeyToUse);
        }
        
        // Call the filing function
        await fileCompanyReturns({
            companies,
            monthYear,
            filingDate: new Date(filingDate),
            onProgress,
            supabaseUrl: supabaseUrlToUse,
            supabaseKey: supabaseKeyToUse,
            credentials
        });
        
        console.log('All filings completed');
    } catch (error) {
        console.error('Error in filing process:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'not configured');
    console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'not configured');
});
