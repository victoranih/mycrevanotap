INSERT INTO subscription_plans (id, name, billing_period, price) VALUES
  ('monthly', 'Monthly', 'monthly', 25000),
  ('yearly', 'Yearly', 'yearly', 240000),
  ('enterprise', 'Enterprise', 'enterprise', NULL)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    billing_period = EXCLUDED.billing_period,
    price = EXCLUDED.price;

INSERT INTO clients (company_name, contact_name, email, status) VALUES
  ('Crestline Telecoms Plc', 'Ada Okafor', 'ada@crestline.example', 'Active'),
  ('Lagos Meridian Hotels Ltd', 'Tunde Bello', 'tunde@meridian.example', 'Active'),
  ('Oakbelt Manufacturing Ltd', 'Mariam Yusuf', 'mariam@oakbelt.example', 'Active')
ON CONFLICT (email) DO NOTHING;

INSERT INTO subscriptions (client_id, plan_id, status, starts_on, renews_on)
SELECT id, 'yearly', 'Active', '2026-01-01', '2027-01-01'
FROM clients
WHERE email = 'ada@crestline.example';

INSERT INTO subscriptions (client_id, plan_id, status, starts_on, renews_on)
SELECT id, 'enterprise', 'Active', '2026-02-01', NULL
FROM clients
WHERE email = 'tunde@meridian.example';

INSERT INTO subscriptions (client_id, plan_id, status, starts_on, renews_on)
SELECT id, 'monthly', 'Past Due', '2026-05-01', '2026-06-01'
FROM clients
WHERE email = 'mariam@oakbelt.example';

INSERT INTO applications (
  title, contract_type, certificate_number, duration_years, effective_date, approved_fee,
  currency, transferor, transferee, sector, status
) VALUES
  (
    'Cloud Infrastructure License Transfer', 'New', 'CR 24891', 3, '2024-07-01', 18500000,
    'NGN', 'NovaScale Systems Ltd', 'Crestline Telecoms Plc', 'ICT', 'Approved'
  ),
  (
    'Hotel Operations Management Agreement', 'Renewal', 'CR 20344', 5, '2021-06-15', 275000,
    'USD', 'HarborGate Hospitality Inc', 'Lagos Meridian Hotels Ltd', 'Hotels & Restaurants', 'Approved'
  ),
  (
    'Manufacturing Process Know-how Transfer', 'Extention', 'CR 17806', 2, '2023-02-10', 42000000,
    'NGN', 'Kintaro Industrial Japan', 'Oakbelt Manufacturing Ltd', 'Manufacturing', 'Approved'
  ),
  (
    'Franchise Brand Support Agreement', 'Additional fee', 'CR 30015', 3, '2026-02-01', 63000000,
    'NGN', 'BlueArc Franchise Global', 'Creekside Retail Services', 'Franchising', 'Pending'
  );

INSERT INTO remittances (application_id, remittance_type, amount, currency, remitted_on)
SELECT id, 'Remittance', 8500000, 'NGN', '2024-09-13'
FROM applications WHERE certificate_number = 'CR 24891';

INSERT INTO remittances (application_id, remittance_type, amount, currency, remitted_on)
SELECT id, 'WHT', 1850000, 'NGN', '2024-09-13'
FROM applications WHERE certificate_number = 'CR 24891';

INSERT INTO remittances (application_id, remittance_type, amount, currency, remitted_on)
SELECT id, 'Remittance', 5500000, 'NGN', '2025-03-04'
FROM applications WHERE certificate_number = 'CR 24891';

INSERT INTO remittances (application_id, remittance_type, amount, currency, remitted_on)
SELECT id, 'Remittance', 225000, 'USD', '2022-02-17'
FROM applications WHERE certificate_number = 'CR 20344';

INSERT INTO remittances (application_id, remittance_type, amount, currency, remitted_on)
SELECT id, 'WHT', 50000, 'USD', '2022-02-17'
FROM applications WHERE certificate_number = 'CR 20344';

INSERT INTO remittances (application_id, remittance_type, amount, currency, remitted_on)
SELECT id, 'Remittance', 22000000, 'NGN', '2023-09-06'
FROM applications WHERE certificate_number = 'CR 17806';
