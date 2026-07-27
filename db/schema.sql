DROP TABLE IF EXISTS remittances;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS subscription_payments;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS subscription_plans;

CREATE TABLE subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly', 'enterprise')),
  price NUMERIC(18, 2),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE clients (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  email_verified_at TIMESTAMPTZ,
  email_verification_token_hash TEXT,
  email_verification_expires_at TIMESTAMPTZ,
  password_reset_token_hash TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_sessions (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_sessions_client_id_idx ON user_sessions(client_id);
CREATE INDEX user_sessions_expires_at_idx ON user_sessions(expires_at);

CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Trial', 'Active', 'Past Due', 'Cancelled')),
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  renews_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscription_payments (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount NUMERIC(18, 2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Pending', 'Paid', 'Failed')),
  paid_on TIMESTAMPTZ,
  provider_reference TEXT,
  paystack_access_code TEXT,
  paystack_authorization_url TEXT,
  paystack_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscription_payments_provider_reference_uidx
  ON subscription_payments(provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE TABLE applications (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'New' CHECK (contract_type IN ('New', 'Renewal', 'Extention', 'Additional fee')),
  extending_certificate_number TEXT,
  certificate_number TEXT NOT NULL UNIQUE CHECK (certificate_number ~ '^CR [0-9]+$'),
  duration_years INTEGER NOT NULL CHECK (duration_years BETWEEN 1 AND 5),
  effective_date DATE NOT NULL,
  approved_fee NUMERIC(18, 2) NOT NULL CHECK (approved_fee >= 0),
  currency CHAR(3) NOT NULL,
  transferor TEXT NOT NULL,
  transferee TEXT NOT NULL,
  sector TEXT NOT NULL CHECK (
    sector IN ('ICT', 'Manufacturing', 'Finance & Insurance', 'Hotels & Restaurants', 'Oil & Gas', 'Agriculture/Forestry', 'Civil Construction', 'Transport & Logistics', 'Franchising', 'Power & Energy', 'Mining & Quarry', 'Gaming', 'Aviation')
  ),
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (sector IN ('Hotels & Restaurants', 'Agriculture/Forestry') AND duration_years BETWEEN 1 AND 5)
    OR
    (sector NOT IN ('Hotels & Restaurants', 'Agriculture/Forestry') AND duration_years BETWEEN 1 AND 3)
  ),
  CHECK (
    contract_type NOT IN ('Renewal', 'Extention', 'Additional fee')
    OR extending_certificate_number IS NOT NULL
  )
);

CREATE TABLE remittances (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  remittance_type TEXT NOT NULL CHECK (remittance_type IN ('Remittance', 'WHT')),
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  tax_percent NUMERIC(8, 4) NOT NULL DEFAULT 0 CHECK (tax_percent >= 0),
  exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
  amount_in_approved_currency NUMERIC(18, 2) NOT NULL DEFAULT 0,
  remitted_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
