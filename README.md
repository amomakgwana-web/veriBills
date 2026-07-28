# veriBills

Tenant and billing platform for estates, apartment blocks and commercial property.
Built for the South African market: rands and VAT, stepped municipal tariffs,
prepaid electricity tokens, and DebiCheck authenticated debit orders.

Three portals sit on one database:

| Portal | Who | What it does |
| --- | --- | --- |
| **Tenant** (`/tenant`) | Residents and business tenants | Pay rent, levies and water; buy prepaid electricity; per-channel transaction history; log maintenance; generate gate codes; book facilities; manage profile, lease and estate policies |
| **Estate** (`/estate`) | Landlords and managing agents | Run billing, chase arrears, propose payment plans, manage DebiCheck collections, approvals, bulk email/SMS, usage flags, audit trail |
| **Platform** (`/admin`) | System operators | White-label branding, unit and tariff configuration, meter integration, delivery trails, system health, transaction statements |

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions), React 19, TypeScript
- **Supabase** — Postgres 17, Auth, row level security
- **Tailwind CSS 4**

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are pre-filled for
the `veriBills` project. `SUPABASE_SERVICE_ROLE_KEY` is **required** for billing
runs, payment settlement and prepaid token issue — the app boots without it and
tells you which features are disabled.

```bash
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # domain logic tests
```

## Architecture

### The ledger is the source of truth

Every charge and payment lands in `ledger_entries` as an append-only row tagged
with a **channel** (rent, levy, water, electricity, maintenance…). A trigger
maintains the running balance and the account total in the same statement, and
`UPDATE`/`DELETE` are rejected outright — corrections are posted as reversing
entries. This is what makes the tenant's per-channel history and the platform
statement reconcile by construction rather than by convention.

### What runs in the database

Money movement lives in SQL, not in application code, so it is correct
regardless of which client calls it:

- `run_billing()` — walks active leases, bills contracted rent and levies,
  recurring charges and metered consumption, then posts per-channel ledger debits.
  Re-running a period is safe: already-billed accounts are skipped.
- `settle_payment()` — allocates a payment oldest-invoice-first, writes
  allocations, posts ledger credits, and leaves any excess as account credit.
- `calculate_tariff_cost()` / `units_for_amount()` — stepped block tariffs and
  their inverse, for "how many kWh does R500 buy?"
- `detect_usage_anomaly()` — compares each reading against that meter's own
  30-day baseline and raises an alert, escalating past 150% deviation.
- `compute_tenant_score()` — 0–100 behaviour score from payment history.
- `redeem_access_code()` / `check_facility_access()` — atomic validate-and-log.

### Security model

Row level security is enabled on all 63 tables, with three tiers:

- **System admins** (`profiles.is_system_admin`) see everything.
- **Org staff** see rows belonging to orgs they are an active member of, further
  narrowed by role (`owner`, `admin`, `manager`, `finance`, `maintenance`, `viewer`).
- **Tenants** see only rows tied to their own leases, units and profile.

Policies call `SECURITY DEFINER` helpers (`has_org_access`, `current_lease_ids`,
…) so they do not recurse through the tables they read.

Writes are deliberately narrower than reads. A browser session can start a
payment but cannot allocate it; it can log a maintenance request but cannot
write an internal note. Anything that moves money runs under the service role
from server-side code. `EXECUTE` is revoked from `PUBLIC` on the whole schema
and re-granted only to the handful of functions the client legitimately needs —
without that, Postgres' default `PUBLIC` grant leaves `run_billing` and
`settle_payment` callable unauthenticated over `/rest/v1/rpc`.

Card numbers are never stored: only a gateway token and the last four digits.
Bank account numbers are masked. Integration credentials live in the environment
and are referenced from the database by name, never by value.

### Integrations

Every external dependency sits behind an interface in `src/lib/integrations/`,
with a deterministic mock that makes the whole platform work end to end without
third-party credentials:

| Capability | Interface | Env var |
| --- | --- | --- |
| Card acquiring + 3DS | `PaymentGateway` | `PAYMENT_GATEWAY_PROVIDER` |
| Prepaid token vending | `TokenVendor` | `TOKEN_VENDOR_PROVIDER` |
| DebiCheck mandates | `DebiCheckProvider` | `DEBICHECK_PROVIDER` |
| Email | `EmailProvider` | `EMAIL_PROVIDER` |
| SMS | `SmsProvider` | `SMS_PROVIDER` |
| AMI meter reads | `MeterVendor` | `METER_VENDOR_PROVIDER` |

Mocks are seeded from the request reference rather than random, so demos repeat
and failure branches can be triggered on purpose:

- amount ending in `.13` → declined
- amount ending in `.05`, or ≥ R5 000 → 3DS challenge
- meter number ending `0000` → unknown meter
- roughly 1 in 8 DebiCheck collections fails

The 3DS challenge page at `/api/payments/3ds/challenge` stands in for the
issuer, so the challenge → return → capture path is exercised in development.

## Database

Migrations are in `supabase/migrations/`, applied in filename order:

| Migration | Contents |
| --- | --- |
| `…120000_core_foundations` | Extensions, enums, organisations, branding, profiles, membership |
| `…120100_property_and_leases` | Properties, units, tariffs, meters, leases, documents |
| `…120200_billing_and_payments` | Accounts, ledger, invoices, payments, plans, DebiCheck |
| `…120300_utilities_maintenance_access` | Prepaid electricity, usage monitoring, maintenance, gate access, facilities |
| `…120400_comms_approvals_admin` | Announcements, campaigns, delivery trail, applications, approvals, banking, audit, integrations, chat |
| `…120500_functions_and_triggers` | Scoping helpers, sequences, ledger triggers, billing run, tariff maths, anomaly detection, scoring |
| `…120600_rls_policies` | Row level security on every table |
| `…120700_harden_function_grants` | Revoke `PUBLIC` execute, pin `search_path` |

Regenerate types after a schema change:

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
```

## Known gaps

Honest list of what is scaffolded rather than finished:

- **Chatbot** answers by keyword matching against the caller's own data. The
  transport, persistence and escalation path are real; the responder is a
  placeholder for a model-backed one.
- **Invoice and statement PDFs** — `invoices.pdf_path` exists and the letterhead
  renders for email, but PDF generation is not wired up.
- **Campaign scheduling** — the schema carries send windows, throttling and
  expiry; the sender currently dispatches immediately or saves a draft.
- **Accounting export** — ledger entries are export-ready and the
  `accounting_exports` table exists, but no provider is connected.
- **Document storage** — records and RLS are in place; file upload to Supabase
  Storage is not yet built.
- **Webhook receivers** for gateway and provider callbacks are modelled
  (`webhook_events`) but the endpoints are not implemented, so delivery
  receipts stay at `sent` rather than progressing to `delivered`/`opened`.
