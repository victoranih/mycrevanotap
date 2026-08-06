# CREVA Notap Client Desk

A React/Vite prototype for managing NOTAP technology transfer applications, backed by PostgreSQL through a small Node API.

## What is included

- Subscription gate before application management access.
- Client login screen with demo authentication flow.
- Secure client signup/login backed by PostgreSQL, PBKDF2 password hashing, email verification tokens, password reset tokens, and token sessions.
- Signup -> email verify -> login -> subscription -> dashboard flow.
- Forgot password link on the login form for password recovery.
- Subscription/payment screens for monthly, yearly, and enterprise plans.
- CREVA admin dashboard for client subscriptions, revenue, sectors, and action queues.
- Application dashboard with approved, pending, expiring, expired, renewal, extension, and invoice guidance.
- ContractType dropdown on each application: New, Renewal, Extention, Additional fee.
- Extention applications require the certificate number being extended; approved fee is automatically set to the outstanding balance on that certificate.
- Renewal, Extention, and Additional fee applications require a referenced certificate number and copy title, status, sector, transferor, and transferee from that referenced certificate.
- Edit existing application information after entry.
- Edit recorded remittance and WHT tranches after entry.
- Sector duration rules:
  - Hotels & Restaurants and Agriculture/Forestry: 1-5 years.
  - ICT, Manufacturing, Finance & Insurance, Oil & Gas, Civil Construction, Transport & Logistics, Franchising, Power & Energy, Mining & Quarry, Gaming, Aviation: 1-3 years.
- Certificate number mask using `CR ` prefix.
- Unique certificate number validation.
- Remittance and WHT tranche recording.
- Tax % field for new remittance entries. When Tax % is provided, the app saves net Remittance and calculated WHT tranches using `WHT = gross remittance * tax% / 100` and `net remittance = gross remittance - WHT`.
- Currency selectors for approved fees, remittances, and WHT.
- Exchange-rate conversion when remittance or WHT currency differs from the application approved-fee currency:
  - Approved fee in foreign currency, remittance in same foreign currency, WHT in Naira: `balance = approved fee - remittance - (WHT / exchange rate)`.
  - Approved fee in Naira, remittance in foreign currency, WHT in Naira: `balance = approved fee - (remittance * exchange rate) - WHT`.
  - Approved fee in foreign currency, remittance and WHT in same foreign currency: `balance = approved fee - remittance - WHT`.
- Thousand-separated currency display.
- Balance enforcement so total remittance plus WHT cannot exceed the approved fee.
- Responsive layout for desktop, tablet, and mobile screens.
- PostgreSQL schema, seed data, and API routes for applications and remittance tranches.
- PostgreSQL tables for clients, subscription plans, subscriptions, and subscription payments.
- PostgreSQL session table for authenticated users.

## Database setup

Create a PostgreSQL database named `creva_notap`, then run:

```powershell
psql -U postgres -d creva_notap -f db/schema.sql
psql -U postgres -d creva_notap -f db/seed.sql
```

For an existing database created before exchange rates were added, run:

```powershell
psql -U postgres -d creva_notap -f db/migration-add-exchange-rate.sql
```

If your database already had the earlier exchange-rate version, run this to use multiplication conversion:

```powershell
psql -U postgres -d creva_notap -f db/migration-exchange-rate-multiply.sql
```

For the latest currency-aware rule, run:

```powershell
psql -U postgres -d creva_notap -f db/migration-exchange-rate-currency-aware.sql
```

For secured signup/login support, run:

```powershell
psql -U postgres -d creva_notap -f db/migration-add-secure-auth.sql
```

In this local prototype, verification and reset tokens are displayed on screen instead of being emailed. In production, send those tokens through an email provider and do not display them in the browser.

For Extention certificate references, run:

```powershell
psql -U postgres -d creva_notap -f db/migration-add-extension-certificate-reference.sql
```

For Renewal, Extention, and Additional fee referenced-certificate requirements, run:

```powershell
psql -U postgres -d creva_notap -f db/migration-reference-certificate-for-renewal-additional-fee.sql
```

For remittance Tax % support, run:

```powershell
psql -U postgres -d creva_notap -f db/migration-add-remittance-tax-percent.sql
```

For Paystack subscription payments, run:

```powershell
psql -U postgres -d creva_notap -f db/migration-add-paystack-payments.sql
```

For an existing database created before login/subscriptions were added, run:

```powershell
psql -U postgres -d creva_notap -f db/migration-add-clients-subscriptions.sql
```

The default connection string is:

```text
postgres://postgres:postgres@localhost:5432/creva_notap
```

To use a different database user, password, host, or database name, set `DATABASE_URL` before starting the API.

## Run locally

```powershell
npm.cmd install
npm.cmd run server
```

In a second PowerShell window:

```powershell
npm.cmd run dev
```

Then open the local Vite URL shown in the terminal.

The API runs on `http://127.0.0.1:4000`, and Vite proxies `/api` requests to it.

## Paystack setup

Create a Paystack test account and copy your test secret key. Keep the secret key only on the backend:

```powershell
$env:PAYSTACK_SECRET_KEY="sk_test_your_key"
$env:CLIENT_ORIGIN="http://127.0.0.1:5173"
$env:PAYSTACK_CALLBACK_URL="http://127.0.0.1:5173/"
```

The React app calls the backend to initialize payment, redirects the user to Paystack, then verifies the returned `reference` before unlocking the dashboard.

## Free test deployment

A simple free testing setup is:

- Backend API: Render Web Service.
- Frontend: Render Static Site, Netlify, or Vercel.
- PostgreSQL: Supabase free project, Neon free project, or Render PostgreSQL for temporary testing.

Backend settings:

```text
Build command: npm install
Start command: node server/index.js
Environment:
  DATABASE_URL=your_postgres_connection_string
  PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
  CLIENT_ORIGIN=https://your-frontend-url
  PAYSTACK_CALLBACK_URL=https://your-frontend-url/
```

Frontend settings:

```text
Build command: npm install && npm run build
Publish directory: dist
Environment:
  VITE_API_URL=https://your-backend-api-url
```

`VITE_API_BASE_URL` is also supported, but use `VITE_API_URL` if you are setting it up fresh.

After deployment, run `db/schema.sql` and `db/seed.sql` on the hosted PostgreSQL database. If the database already exists, run the migration files listed above, especially `db/migration-add-paystack-payments.sql`.
