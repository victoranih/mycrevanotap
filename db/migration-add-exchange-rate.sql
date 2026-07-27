ALTER TABLE remittances
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0);

ALTER TABLE remittances
ADD COLUMN IF NOT EXISTS amount_in_approved_currency NUMERIC(18, 2) NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS remittances_do_not_exceed_approved_fee ON remittances;
DROP TRIGGER IF EXISTS remittances_calculate_and_validate ON remittances;

CREATE OR REPLACE FUNCTION prevent_excess_remittance()
RETURNS TRIGGER AS $$
DECLARE
  approved NUMERIC(18, 2);
  approved_currency CHAR(3);
  total NUMERIC(18, 2);
BEGIN
  SELECT approved_fee, currency INTO approved, approved_currency
  FROM applications
  WHERE id = NEW.application_id;

  NEW.amount_in_approved_currency := CASE
    WHEN NEW.currency = approved_currency THEN NEW.amount
    WHEN approved_currency = 'NGN' THEN NEW.amount * NEW.exchange_rate
    WHEN NEW.currency = 'NGN' THEN NEW.amount / NEW.exchange_rate
    ELSE NEW.amount * NEW.exchange_rate
  END;

  SELECT COALESCE(SUM(amount_in_approved_currency), 0) INTO total
  FROM remittances
  WHERE application_id = NEW.application_id
    AND id <> COALESCE(NEW.id, 0);

  IF total + NEW.amount_in_approved_currency > approved THEN
    RAISE EXCEPTION 'Total remittance and WHT cannot exceed approved fee.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER remittances_calculate_and_validate
BEFORE INSERT OR UPDATE ON remittances
FOR EACH ROW
EXECUTE FUNCTION prevent_excess_remittance();
