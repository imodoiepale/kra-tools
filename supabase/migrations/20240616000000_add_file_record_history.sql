-- Create history table
CREATE TABLE IF NOT EXISTS public.file_record_history (
    id BIGSERIAL PRIMARY KEY,
    file_record_id BIGINT REFERENCES public.file_records(id) ON DELETE CASCADE,
    company_id UUID NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    received_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    brought_by TEXT,
    picked_by TEXT,
    received_by TEXT,
    delivered_to TEXT,
    is_nil BOOLEAN DEFAULT false,
    is_urgent BOOLEAN DEFAULT false,
    notes TEXT,
    document_types TEXT[],
    delivery_method TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    processing_status TEXT,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    action_type TEXT NOT NULL -- 'create', 'update', or 'delete'
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_file_record_history_company_date ON public.file_record_history(company_id, year, month);

-- Create a function to handle the history tracking
CREATE OR REPLACE FUNCTION public.handle_file_record_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.file_record_history (
            file_record_id, company_id, year, month, received_at, delivered_at,
            brought_by, picked_by, received_by, delivered_to, is_nil, is_urgent,
            notes, document_types, delivery_method, contact_phone, contact_email,
            processing_status, updated_by, action_type
        ) VALUES (
            NEW.id, NEW.company_id, NEW.year, NEW.month, NEW.received_at, NEW.delivered_at,
            NEW.brought_by, NEW.picked_by, NEW.received_by, NEW.delivered_to, NEW.is_nil, NEW.is_urgent,
            NEW.notes, NEW.document_types, NEW.delivery_method, NEW.contact_phone, NEW.contact_email,
            NEW.processing_status, NEW.updated_by, 'create'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.file_record_history (
            file_record_id, company_id, year, month, received_at, delivered_at,
            brought_by, picked_by, received_by, delivered_to, is_nil, is_urgent,
            notes, document_types, delivery_method, contact_phone, contact_email,
            processing_status, updated_by, action_type
        ) VALUES (
            NEW.id, NEW.company_id, NEW.year, NEW.month, NEW.received_at, NEW.delivered_at,
            NEW.brought_by, NEW.picked_by, NEW.received_by, NEW.delivered_to, NEW.is_nil, NEW.is_urgent,
            NEW.notes, NEW.document_types, NEW.delivery_method, NEW.contact_phone, NEW.contact_email,
            NEW.processing_status, NEW.updated_by, 'update'
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.file_record_history (
            file_record_id, company_id, year, month, received_at, delivered_at,
            brought_by, picked_by, received_by, delivered_to, is_nil, is_urgent,
            notes, document_types, delivery_method, contact_phone, contact_email,
            processing_status, updated_by, action_type
        ) VALUES (
            OLD.id, OLD.company_id, OLD.year, OLD.month, OLD.received_at, OLD.delivered_at,
            OLD.brought_by, OLD.picked_by, OLD.received_by, OLD.delivered_to, OLD.is_nil, OLD.is_urgent,
            OLD.notes, OLD.document_types, OLD.delivery_method, OLD.contact_phone, OLD.contact_email,
            OLD.processing_status, OLD.updated_by, 'delete'
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to track changes
DROP TRIGGER IF EXISTS file_records_history_trigger ON public.file_records;
CREATE TRIGGER file_records_history_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.file_records
FOR EACH ROW EXECUTE FUNCTION public.handle_file_record_history();

-- Create a function to handle upsert with history
CREATE OR REPLACE FUNCTION public.upsert_file_record_with_history(
    p_company_id UUID,
    p_year INTEGER,
    p_month INTEGER,
    p_received_at TIMESTAMPTZ DEFAULT NULL,
    p_delivered_at TIMESTAMPTZ DEFAULT NULL,
    p_brought_by TEXT DEFAULT NULL,
    p_picked_by TEXT DEFAULT NULL,
    p_received_by TEXT DEFAULT NULL,
    p_delivered_to TEXT DEFAULT NULL,
    p_is_nil BOOLEAN DEFAULT false,
    p_is_urgent BOOLEAN DEFAULT false,
    p_notes TEXT DEFAULT NULL,
    p_document_types TEXT[] DEFAULT NULL,
    p_delivery_method TEXT DEFAULT NULL,
    p_contact_phone TEXT DEFAULT NULL,
    p_contact_email TEXT DEFAULT NULL,
    p_processing_status TEXT DEFAULT NULL,
    p_updated_by UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_record_id BIGINT;
    v_result JSONB;
BEGIN
    -- Try to insert or update the record
    INSERT INTO public.file_records (
        company_id, year, month, received_at, delivered_at,
        brought_by, picked_by, received_by, delivered_to, is_nil, is_urgent,
        notes, document_types, delivery_method, contact_phone, contact_email,
        processing_status, updated_by
    ) VALUES (
        p_company_id, p_year, p_month, p_received_at, p_delivered_at,
        p_brought_by, p_picked_by, p_received_by, p_delivered_to, p_is_nil, p_is_urgent,
        p_notes, p_document_types, p_delivery_method, p_contact_phone, p_contact_email,
        p_processing_status, p_updated_by
    )
    ON CONFLICT (company_id, year, month)
    DO UPDATE SET
        received_at = EXCLUDED.received_at,
        delivered_at = EXCLUDED.delivered_at,
        brought_by = EXCLUDED.brought_by,
        picked_by = EXCLUDED.picked_by,
        received_by = EXCLUDED.received_by,
        delivered_to = EXCLUDED.delivered_to,
        is_nil = EXCLUDED.is_nil,
        is_urgent = EXCLUDED.is_urgent,
        notes = EXCLUDED.notes,
        document_types = EXCLUDED.document_types,
        delivery_method = EXCLUDED.delivery_method,
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        processing_status = EXCLUDED.processing_status,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    RETURNING id INTO v_record_id;

    -- Get the full record to return
    SELECT to_jsonb(r.*) INTO v_result
    FROM public.file_records r
    WHERE r.id = v_record_id;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error in upsert_file_record_with_history: %', SQLERRM;
END;
$$;
