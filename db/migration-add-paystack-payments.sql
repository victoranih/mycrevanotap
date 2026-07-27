ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS paystack_access_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_authorization_url TEXT,
  ADD COLUMN IF NOT EXISTS paystack_response JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_provider_reference_uidx
  ON subscription_payments(provider_reference)
  WHERE provider_reference IS NOT NULL;
