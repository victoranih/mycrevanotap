CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly', 'enterprise')),
  price NUMERIC(18, 2),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Trial', 'Active', 'Past Due', 'Cancelled')),
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  renews_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount NUMERIC(18, 2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Pending', 'Paid', 'Failed')),
  paid_on TIMESTAMPTZ,
  provider_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL;

INSERT INTO subscription_plans (id, name, billing_period, price) VALUES
  ('monthly', 'Monthly', 'monthly', 25000),
  ('yearly', 'Yearly', 'yearly', 240000),
  ('enterprise', 'Enterprise', 'enterprise', NULL)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    billing_period = EXCLUDED.billing_period,
    price = EXCLUDED.price;
