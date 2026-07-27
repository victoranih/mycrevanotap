ALTER TABLE applications
ADD COLUMN IF NOT EXISTS extending_certificate_number TEXT;

ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_extension_certificate_required_check;

UPDATE applications
SET extending_certificate_number = certificate_number
WHERE contract_type = 'Extention'
  AND extending_certificate_number IS NULL;

ALTER TABLE applications
ADD CONSTRAINT applications_extension_certificate_required_check CHECK (
  contract_type <> 'Extention'
  OR extending_certificate_number IS NOT NULL
);
