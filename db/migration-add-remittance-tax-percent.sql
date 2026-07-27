ALTER TABLE remittances
ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(8, 4) NOT NULL DEFAULT 0 CHECK (tax_percent >= 0);
