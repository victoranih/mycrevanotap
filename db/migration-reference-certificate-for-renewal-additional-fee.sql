ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_extension_certificate_required_check;

ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_reference_certificate_required_check;

UPDATE applications
SET extending_certificate_number = certificate_number
WHERE contract_type IN ('Renewal', 'Extention', 'Additional fee')
  AND extending_certificate_number IS NULL;

ALTER TABLE applications
ADD CONSTRAINT applications_reference_certificate_required_check CHECK (
  contract_type NOT IN ('Renewal', 'Extention', 'Additional fee')
  OR extending_certificate_number IS NOT NULL
);
