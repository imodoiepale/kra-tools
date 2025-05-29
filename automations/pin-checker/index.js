// @ts-nocheck
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { processBatch, readCompanyBatch } = require('./worker');

// Express app setup
const app = express();
app.use(bodyParser.json());

// Set port from environment or default to 3000
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// Webhook endpoint for n8n to trigger the automation
app.post('/webhook/pin-checker', async (req, res) => {
    try {
        console.log('Received webhook request:', req.body);
        
        // Extract parameters from the webhook request
        const { 
            startIndex = 0, 
            batchSize = 5,
            totalCompanies = 0,
            n8nWorkflowId = '',
            callbackUrl = ''
        } = req.body;
        
        // Validate required parameters
        if (startIndex === undefined) {
            return res.status(400).json({ error: 'startIndex parameter is required' });
        }
        
        // Acknowledge the request immediately
        res.status(202).json({ 
            message: 'Automation started', 
            startIndex,
            batchSize,
            status: 'processing'
        });
        
        // Process the batch asynchronously
        processBatchAndCallback(startIndex, batchSize, totalCompanies, callbackUrl, n8nWorkflowId);
        
    } catch (error) {
        console.error('Error handling webhook:', error);
        // Since we already sent a response, we'll just log the error
        // The callback mechanism will handle reporting the error back to n8n
    }
});

// Get the total count of companies
app.get('/companies/count', async (req, res) => {
    try {
        // This is a simplified version - in a real scenario you'd query Supabase directly
        const companies = await readCompanyBatch(0, 9999999);
        res.status(200).json({ count: companies.length });
    } catch (error) {
        console.error('Error getting company count:', error);
        res.status(500).json({ error: error.message });
    }
});

// Function to process batch and send callback when done
async function processBatchAndCallback(startIndex, batchSize, totalCompanies, callbackUrl, n8nWorkflowId) {
    let result;
    
    try {
        // Process the batch
        console.log(`Starting batch processing: startIndex=${startIndex}, batchSize=${batchSize}`);
        result = await processBatch(startIndex, batchSize, totalCompanies);
        console.log(`Batch processing complete. Processed ${result.processed} companies.`);
        
        // Send callback to n8n if a callback URL was provided
        if (callbackUrl) {
            await sendCallback(callbackUrl, {
                status: 'completed',
                startIndex,
                batchSize,
                processed: result.processed,
                success: result.success,
                n8nWorkflowId,
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('Error in processBatchAndCallback:', error);
        
        // Send error callback
        if (callbackUrl) {
            await sendCallback(callbackUrl, {
                status: 'error',
                startIndex,
                batchSize,
                processed: 0,
                success: false,
                n8nWorkflowId,
                error: error.message
            });
        }
    }
}

// Function to send callback to n8n
async function sendCallback(callbackUrl, data) {
    try {
        console.log(`Sending callback to ${callbackUrl}`, data);
        const response = await fetch(callbackUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            console.error(`Callback to ${callbackUrl} failed with status ${response.status}`);
        } else {
            console.log(`Callback to ${callbackUrl} succeeded`);
        }
        
    } catch (error) {
        console.error('Error sending callback:', error);
    }
}

// Start the server
app.listen(PORT, () => {
    console.log(`PIN checker automation server listening on port ${PORT}`);
});