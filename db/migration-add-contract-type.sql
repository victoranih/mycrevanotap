ALTER TABLE applications
ADD COLUMN IF NOT EXISTS contract_type TEXT NOT NULL DEFAULT 'New';

ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_contract_type_check;

ALTER TABLE applications
ADD CONSTRAINT applications_contract_type_check CHECK (
  contract_type IN ('New', 'Renewal', 'Extention', 'Additional fee')
);
