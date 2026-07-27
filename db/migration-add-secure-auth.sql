ALTER TABLE clients
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sessions_client_id_idx ON user_sessions(client_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions(expires_at);

INSERT INTO subscription_plans (id, name, billing_period, price) VALUES
  ('monthly', 'Monthly', 'monthly', 25000),
  ('yearly', 'Yearly', 'yearly', 240000),
  ('enterprise', 'Enterprise', 'enterprise', NULL)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    billing_period = EXCLUDED.billing_period,
    price = EXCLUDED.price;
