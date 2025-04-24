import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
// -----------------------------------------------------------------------------
// Configuration (replace placeholder values with your actual credentials)
// -----------------------------------------------------------------------------

const SUPABASE_URL = 'https://zyszsqgdlrpnunkegipk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5c3pzcWdkbHJwbnVua2VnaXBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwODMyNzg5NCwiZXhwIjoyMDIzOTAzODk0fQ.7ICIGCpKqPMxaSLiSZ5MNMWRPqrTr5pHprM0lBaNing';
const GEMINI_API_KEY = "AIzaSyDj7zEkHAPZ0kd7m6KiBMfhlt-TFNp6UHg"
const EMBEDDING_MODEL = 'gemini-embedding-exp-03-07';

// Directory containing PDFs (absolute or relative)
const STATEMENTS_DIR = 'C:\\Users\\DELL\\Downloads\\BANKS';
// Maximum number of documents to process
const MAX_DOCS = 5;

console.log(`▶️ Reading PDFs from: ${STATEMENTS_DIR}`);

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// Initialize Gemini client
const genAI = new GoogleGenerativeAI({ apiKey: GEMINI_API_KEY });

// -----------------------------------------------------------------------------
// Field Extraction Logic
// -----------------------------------------------------------------------------
function extractFields(text) {
    const matchGroup = (re) => {
        const m = text.match(re);
        return m ? m[1].trim() : null;
    };

    const bank_name = matchGroup(/Bank\s*[:\-]\s*(.+)/i);
    const account_number = matchGroup(/Account\s*Number\s*[:\-]\s*([\d\-]+)/i);
    const currency = matchGroup(/Currency\s*[:\-]\s*([A-Z]{3})/i);
    const opening_balance = parseFloat(matchGroup(/Opening\s*Balance\s*[:\-]\s*([\d,\.]+)/i)?.replace(/,/g, '')) || null;
    const closing_balance = parseFloat(matchGroup(/Closing\s*Balance\s*[:\-]\s*([\d,\.]+)/i)?.replace(/,/g, '')) || null;
    const period_raw = matchGroup(/Statement\s*Period\s*[:\-]\s*([\w\s,\-–]+)/i);

    let statement_type = 'monthly';
    let statement_month = null;
    let statement_year = null;

    if (period_raw) {
        if (/[-–]/.test(period_raw)) {
            statement_type = 'range';
        } else {
            const ym = period_raw.match(/([A-Za-z]+)\s+(\d{4})/);
            if (ym) {
                statement_month = new Date(Date.parse(`${ym[1]} 1, 2000`)).getMonth() + 1;
                statement_year = parseInt(ym[2], 10);
            }
        }
    }

    return {
        bank_name, account_number, currency, opening_balance, closing_balance,
        statement_period: period_raw, statement_type, statement_month, statement_year
    };
}

// -----------------------------------------------------------------------------
// Supabase Helpers
// -----------------------------------------------------------------------------
async function findBankByName(name) {
    const { data, error } = await supabase
        .from('acc_portal_banks')
        .select('id')
        .ilike('name', `%${name}%`)
        .limit(1)
        .single();
    if (error) throw new Error(`Bank lookup error: ${error.message}`);
    return data;
}

async function findAccountMapping(accountNumber) {
    const { data, error } = await supabase
        .from('bank_accounts')
        .select('company_id, bank_id')
        .eq('account_number', accountNumber)
        .limit(1)
        .single();
    if (error) throw new Error(`Account mapping error: ${error.message}`);
    return data;
}

async function getOrCreateCycle(periodKey) {
    let { data: cycle, error } = await supabase
        .from('statement_cycles')
        .select('id')
        .eq('month_year', periodKey)
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw new Error(`Cycle lookup error: ${error.message}`);
    if (!cycle) {
        const { data: newCycle, error: insertErr } = await supabase
            .from('statement_cycles')
            .insert({ month_year: periodKey })
            .limit(1)
            .single();
        if (insertErr) throw new Error(`Cycle insert error: ${insertErr.message}`);
        cycle = newCycle;
    }
    return cycle;
}

// -----------------------------------------------------------------------------
// Processing Logic (uses Gemini for PDF → text and embeddings)
// -----------------------------------------------------------------------------
async function processStatementFile(fileName) {
    const filePath = path.join(STATEMENTS_DIR, fileName);
    const buffer = await fs.readFile(filePath);

    // 1) Extract text via Gemini Document Understanding
    const docModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const docRes = await docModel.generateContent({
        prompt: {},
        file: { mimeType: 'application/pdf', data: buffer }
    });
    const text = docRes.generations?.[0]?.text;
    if (!text) throw new Error('No text extracted from PDF');

    // 2) Generate embedding for full text
    const embedModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const { embedding } = await embedModel.embedContent(text);

    // 3) Parse fields
    const fields = extractFields(text);
    console.log(`📑 Parsed ${fileName}:`, fields);

    // 4) Resolve bank, account, cycle
    const bank = await findBankByName(fields.bank_name);
    const mapping = await findAccountMapping(fields.account_number);
    const cycle = await getOrCreateCycle(fields.statement_period);

    // 5) Upsert statement
    const payload = {
        company_id: mapping.company_id,
        bank_id: bank.id,
        statement_cycle_id: cycle.id,
        statement_month: fields.statement_month,
        statement_year: fields.statement_year,
        statement_type: fields.statement_type,
        has_soft_copy: true,
        statement_document: { statement_pdf: fileName },
        statement_extractions: {
            ...fields,
            monthly_balances: [],
            embedding
        },
        extraction_performed: true,
        extraction_timestamp: new Date().toISOString()
    };

    const { error } = await supabase
        .from('acc_cycle_bank_statements')
        .upsert(payload, { onConflict: ['company_id', 'bank_id', 'statement_cycle_id'] });

    if (error) throw new Error(`Upsert error for ${fileName}: ${error.message}`);
    console.log(`✅ Processed and upserted ${fileName}`);
}

async function main() {
    try {
        const files = (await fs.readdir(STATEMENTS_DIR))
            .filter(f => f.toLowerCase().endsWith('.pdf'))
            .slice(0, MAX_DOCS);

        for (const file of files) {
            try {
                await processStatementFile(file);
            } catch (err) {
                console.error(`⚠️ Error processing ${file}: ${err.message}`);
            }
        }
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

// Execute
main();
