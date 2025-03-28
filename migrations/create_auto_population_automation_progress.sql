-- Create AutoPopulation_AutomationProgress table
CREATE TABLE IF NOT EXISTS "AutoPopulation_AutomationProgress" (
    id INTEGER PRIMARY KEY,
    progress INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Stopped',
    current_company TEXT DEFAULT '',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial record
INSERT INTO "AutoPopulation_AutomationProgress" (id, progress, status, current_company)
VALUES (1, 0, 'Stopped', '')
ON CONFLICT (id) DO NOTHING;
