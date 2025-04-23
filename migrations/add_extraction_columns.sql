-- Migration to add extraction tracking columns to acc_cycle_bank_statements table

-- Add extraction_performed column (boolean)
ALTER TABLE acc_cycle_bank_statements
ADD COLUMN IF NOT EXISTS extraction_performed BOOLEAN DEFAULT FALSE;

-- Add extraction_timestamp column (timestamp)
ALTER TABLE acc_cycle_bank_statements
ADD COLUMN IF NOT EXISTS extraction_timestamp TIMESTAMPTZ DEFAULT NULL;

-- Add file_name to statement_document JSONB if needed
COMMENT ON COLUMN acc_cycle_bank_statements.statement_document IS 'JSON document containing file paths, size, password, and file name';

-- Add upload_date to statement_document JSONB if needed
COMMENT ON COLUMN acc_cycle_bank_statements.statement_document IS 'JSON document containing file paths, size, password, file name, and upload date';
