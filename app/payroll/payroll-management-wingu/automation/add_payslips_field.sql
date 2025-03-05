-- SQL query to add payslips_file to the default documents JSONB structure

-- First, check the current default value for the documents column
SELECT column_default
FROM information_schema.columns 
WHERE table_name = 'company_payroll_records' 
AND column_name = 'documents';

-- Update the default value for the documents column to include payslips_file
ALTER TABLE company_payroll_records 
ALTER COLUMN documents 
SET DEFAULT '{"all_csv": null, "nssf_exl": null, "paye_csv": null, "shif_exl": null, "hslevy_csv": null, "zip_file_kra": null, "payslips_file": null}'::jsonb;

-- For existing records that don't have the payslips_file field, add it
UPDATE company_payroll_records
SET documents = documents || '{"payslips_file": null}'::jsonb
WHERE NOT (documents ? 'payslips_file');

-- Verify the changes
SELECT id, documents 
FROM company_payroll_records 
LIMIT 5;
