-- Drop the old history table if it exists
DROP TRIGGER IF EXISTS file_records_history_trigger ON public.file_records;
DROP FUNCTION IF EXISTS public.handle_file_record_history();
DROP FUNCTION IF EXISTS public.upsert_file_record_with_history();
DROP TABLE IF EXISTS public.file_record_history;

-- Add history column to file_records
ALTER TABLE public.file_records 
ADD COLUMN IF NOT EXISTS history JSONB[] DEFAULT '{}';

-- Add updated_by column if it doesn't exist
ALTER TABLE public.file_records 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Create or replace function to handle history updates
CREATE OR REPLACE FUNCTION public.update_file_record_with_history()
RETURNS TRIGGER AS $$
DECLARE
    history_entry JSONB;
    user_email TEXT;
    user_record RECORD;
BEGIN
    -- Only create history entry if this is an update (not insert)
    IF TG_OP = 'UPDATE' THEN
        -- Get user email for the history
        SELECT email INTO user_record FROM auth.users WHERE id = NEW.updated_by LIMIT 1;
        user_email := COALESCE(user_record.email, 'system');

        -- Create history entry with old values
        history_entry := jsonb_build_object(
            'changed_at', NOW(),
            'changed_by', user_email,
            'action', 'update',
            'data', (
                SELECT to_jsonb(old_rec.*)
                FROM (SELECT * FROM file_records WHERE id = OLD.id) old_rec
            )
        );

        -- Update history array (keep last 10 entries)
        NEW.history := (
            SELECT array_agg(hist)
            FROM (
                SELECT hist
                FROM unnest(COALESCE(OLD.history, '{}'::jsonb[]) || history_entry) hist
                ORDER BY (hist->>'changed_at')::timestamptz DESC
                LIMIT 9 -- Keep last 9 + current = 10 total
            ) limited_history
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for history updates
DROP TRIGGER IF EXISTS file_records_update_trigger ON public.file_records;
CREATE TRIGGER file_records_update_trigger
BEFORE UPDATE ON public.file_records
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*) -- Only trigger when actual data changes
EXECUTE FUNCTION public.update_file_record_with_history();

-- Update RLS policies if needed
ALTER TABLE public.file_records ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view their company's records
CREATE POLICY "Users can view their company's file records"
ON public.file_records
FOR SELECT
USING (auth.uid() = updated_by);

-- Create policy to allow users to update their own records
CREATE POLICY "Users can update their company's file records"
ON public.file_records
FOR UPDATE
USING (auth.uid() = updated_by);
