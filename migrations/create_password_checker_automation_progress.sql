-- Create PasswordChecker_AutomationProgress table
CREATE TABLE IF NOT EXISTS "PasswordChecker_AutomationProgress" (
    id BIGINT PRIMARY KEY,
    progress DECIMAL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Not Started',
    logs JSONB DEFAULT '[]'::jsonb,
    tab VARCHAR(50) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comments to the table and columns
COMMENT ON TABLE "PasswordChecker_AutomationProgress" IS 'Tracks the progress of password checking automation for different tabs';
COMMENT ON COLUMN "PasswordChecker_AutomationProgress".id IS 'Primary key';
COMMENT ON COLUMN "PasswordChecker_AutomationProgress".progress IS 'Progress percentage of the current automation (0-100)';
COMMENT ON COLUMN "PasswordChecker_AutomationProgress".status IS 'Current status of the automation (Not Started, Running, Stopped, Completed)';
COMMENT ON COLUMN "PasswordChecker_AutomationProgress".logs IS 'JSON array containing log entries for the automation';
COMMENT ON COLUMN "PasswordChecker_AutomationProgress".tab IS 'The tab for which the automation is running (kra, nhif, nssf, ecitizen)';
COMMENT ON COLUMN "PasswordChecker_AutomationProgress".last_updated IS 'Timestamp of the last update to this record';
COMMENT ON COLUMN "PasswordChecker_AutomationProgress".created_at IS 'Timestamp when this record was created';

-- Create an index on the tab column for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_checker_automation_progress_tab ON "PasswordChecker_AutomationProgress"(tab);

-- Create an index on the status for filtering
CREATE INDEX IF NOT EXISTS idx_password_checker_automation_progress_status ON "PasswordChecker_AutomationProgress"(status);

-- Insert initial record if it doesn't exist
INSERT INTO "PasswordChecker_AutomationProgress" (id, progress, status, logs, tab)
VALUES (1, 0, 'Not Started', '[]'::jsonb, 'kra')
ON CONFLICT (id) DO NOTHING;
