-- Create the file_records table with proper references to acc_portal_company_duplicate
CREATE TABLE public.file_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT REFERENCES public.acc_portal_company_duplicate(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    -- Reception fields
    received_at TIMESTAMP,
    received_by VARCHAR(255),
    brought_by VARCHAR(255),
    delivery_method VARCHAR(50),
    document_types TEXT[], -- Array of document types
    files_count INTEGER DEFAULT 0,
    reception_notes TEXT,
    -- Delivery fields
    delivered_at TIMESTAMP,
    delivered_to VARCHAR(255),
    picked_by VARCHAR(255),
    delivery_location VARCHAR(255),
    delivery_notes TEXT,
    -- Status fields
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'processed', 'delivered', 'nil')),
    is_nil BOOLEAN DEFAULT FALSE,
    is_urgent BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(20) DEFAULT 'pending',
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    modification_history JSONB DEFAULT '[]'::jsonb,
    -- Composite unique constraint
    UNIQUE(company_id, year, month)
);

-- Indexes for performance
CREATE INDEX idx_file_records_company_year_month ON public.file_records(company_id, year, month);
CREATE INDEX idx_file_records_status ON public.file_records(status);
CREATE INDEX idx_file_records_year_month ON public.file_records(year, month);
